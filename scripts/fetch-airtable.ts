/**
 * SKB+인바운드 통합관리 베이스에서 인바운드·SKB·레드텔레콤 데이터를 가져와 로컬 JSON으로 저장
 * GitHub Actions에서 실행됨 (시간 제한 없음)
 * 개인정보 필드(연락처)는 가져오지 않음
 *
 * 증분 수집: 인바운드(16,000건대)를 매번 전체 재수집하면 API 호출이 크다.
 * lastModifiedTime 계열 필드가 있는 테이블(인바운드·SKB·정보와기술·레드텔레콤 I/B)은
 * 직전 수집 이후 바뀐 레코드만 filterByFormula로 가져와 기존 JSON에 병합한다.
 * 레드텔레콤 O/B는 그런 필드가 없어(수정일자는 사람이 입력하는 값) 전체 재수집을 유지한다 —
 * 데이터량도 11건 수준이라 비용이 미미하다.
 * 삭제된 레코드는 Airtable API가 통지하지 않아 증분으로 감지할 수 없지만,
 * 실제로 리드를 삭제하는 일이 거의 없어 감수한다.
 */
import fs from 'fs';
import path from 'path';
import { V2Record } from '../src/lib/metrics2/types';
import { isTestRecord } from '../src/lib/test-lead';

const TOKEN = process.env.AIRTABLE_TOKEN!;
const BASE_ID = process.env.AIRTABLE_BASE_ID!;
const OUT_DIR = path.join(__dirname, '../data');
const SYNC_STATE_PATH = path.join(OUT_DIR, '_sync-state.json');

const TABLES = {
  인바운드: 'tbljFHOl4PzAWmb1f',
  SKB: 'tblb5APohbhFixfHB',
  정보와기술: 'tblfWVIcGWZat5z3g', // 대표전화·채널톡 채널을 함께 다루는 테이블
  레드텔레콤_IB: 'tblxlXKRGuumb5Wuz', // 키퍼리드 — 응대·결제·유입채널 지표 있음
  레드텔레콤_OB: 'tbl9eciCX34vrMCpC', // 레드텔레콤 리드 — 결제 건수만 (메모수정시각·lastModifiedTime 없음)
};

/** 테이블별 증분 필터에 쓸 lastModifiedTime 계열 필드명. 없는 테이블은 이 맵에서 뺀다(전체 재수집) */
const SYNC_FIELD: Partial<Record<keyof typeof TABLES, string>> = {
  인바운드: 'Last Modified',
  SKB: 'Last Modified',
  정보와기술: 'Last modified time', // 소문자 m — 증분화를 위해 신설된 필드
  레드텔레콤_IB: '수정시각',
};

type SyncState = Partial<Record<keyof typeof TABLES, string>>; // 테이블명 → 마지막 수집 시각(ISO)

function loadSyncState(): SyncState {
  if (!fs.existsSync(SYNC_STATE_PATH)) return {};
  return JSON.parse(fs.readFileSync(SYNC_STATE_PATH, 'utf-8')) as SyncState;
}

function saveSyncState(state: SyncState) {
  fs.writeFileSync(SYNC_STATE_PATH, JSON.stringify(state, null, 1));
}

// 계산에 필요한 필드만 가져옴 (개인정보 연락처 제외)
// 뒤쪽 5개는 진단 대시보드(metrics3)용 — v2는 앞쪽 필드만 읽으므로 영향 없음
const DIAGNOSIS_FIELDS = [
  '첫응대시각',
  '실패사유',
  '[콜]부재중 상태',
  '전화번호 중복여부',
  '연락 금지',
];
const INBOUND_FIELDS = [
  '고객명', // 테스트 리드 판정용 — 저장하지 않고 버린다
  '유입시간',
  'Last Modified',
  '메모수정시각',
  '[콜]최종 결과',
  '[콜]담당자',
  'UTM_source',
  '진입경로',
  '[콜]온도감', // 인바운드에만 존재
  ...DIAGNOSIS_FIELDS,
];
const SKB_FIELDS = [
  '이름', // 테스트 리드 판정용 — 저장하지 않고 버린다
  '유입시간',
  'Last Modified',
  '메모수정시각',
  '[콜]최종 결과',
  '[콜]담당자',
  'UTM_source',
  ...DIAGNOSIS_FIELDS,
];
const REDTEL_IB_FIELDS = [
  '고객명', // 테스트 리드 판정용 — 저장하지 않고 버린다
  '유입시간',
  '메모수정시각',
  '최종결과', // 값 3종(결제완료/부재중 실패/실패) — 다른 테이블 '[콜]최종 결과'와 값 체계가 다름
  'UTM_source',
];
const REDTEL_OB_FIELDS = [
  '이름', // 테스트 리드 판정용 — 저장하지 않고 버린다
  '유입시간',
  '[콜]최종 결과',
];

// 정보와기술 원본 필드명은 인바운드/SKB와 다르다 — fetch 단계에서
// 유입날짜→유입시간, 메모완료시각→메모수정시각, 유입경로→UTM_source로 리네임해
// 이후 compute.ts(V2Record 기반)를 그대로 재사용한다.
const REP_PHONE_FIELDS = [
  '이름', // 테스트 리드 판정용 — 저장하지 않고 버린다
  '유입날짜',
  '수정일자',
  '메모완료시각',
  '[콜]최종 결과',
  '[콜]담당자',
  '유입경로',
];
type AirtableListResponse<TRecord> = {
  records?: TRecord[];
  offset?: string;
};

async function fetchAll<TRecord>(
  tableId: string,
  fields?: string[],
  filterByFormula?: string
): Promise<TRecord[]> {
  const records: TRecord[] = [];
  let offset: string | undefined;

  while (true) {
    const params = new URLSearchParams({ pageSize: '100' });
    if (offset) params.set('offset', offset);
    if (fields) {
      fields.forEach((f) => params.append('fields[]', f));
    }
    if (filterByFormula) params.set('filterByFormula', filterByFormula);

    const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });

    if (!res.ok) {
      throw new Error(`Airtable API error: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as AirtableListResponse<TRecord>;
    records.push(...(data.records ?? []));
    offset = data.offset;

    if (!offset) break;
    // Rate limit: 5 req/sec
    await new Promise((resolve) => setTimeout(resolve, 220));
  }

  return records;
}

/**
 * 테스트 리드를 걸러내고 이름 필드를 제거한다.
 * 이름은 판정에만 쓰고 저장하지 않는다(개인정보 미수집 원칙).
 */
function stripAndFilter(records: V2Record[], label: string): V2Record[] {
  let dropped = 0;
  const out: V2Record[] = [];
  for (const r of records) {
    const f = r.fields as Record<string, unknown>;
    if (isTestRecord(f)) {
      dropped++;
      continue;
    }
    delete f['고객명'];
    delete f['이름'];
    out.push(r);
  }
  if (dropped > 0) console.log(`  ${label}: 테스트 리드 ${dropped}건 제외`);
  return out;
}

/**
 * 정보와기술 원본 레코드 필드명을 인바운드/SKB 표준 필드명으로 리네임한다.
 * 유입날짜→유입시간, 메모완료시각→메모수정시각, 유입경로→UTM_source.
 * 이렇게 맞춰 두면 metrics2/compute.ts를 수정 없이 그대로 재사용할 수 있다.
 */
function renameRepPhoneFields(records: V2Record[]): V2Record[] {
  return records.map((r) => {
    const f = r.fields as Record<string, unknown>;
    const renamed: Record<string, unknown> = {
      ...f,
      유입시간: f['유입날짜'],
      메모수정시각: f['메모완료시각'],
      UTM_source: f['유입경로'],
    };
    delete renamed['유입날짜'];
    delete renamed['메모완료시각'];
    delete renamed['유입경로'];
    return { id: r.id, fields: renamed } as V2Record;
  });
}

function loadExisting(name: string): V2Record[] {
  const p = path.join(OUT_DIR, `${name}.json`);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as V2Record[];
}

/** 기존 레코드 + 새로 받은 레코드를 ID 기준 병합 (같은 ID는 새 값으로 교체) */
function mergeById(existing: V2Record[], incoming: V2Record[]): V2Record[] {
  const map = new Map(existing.map((r) => [r.id, r]));
  for (const r of incoming) map.set(r.id, r);
  return [...map.values()];
}

/**
 * 한 테이블을 수집한다. SYNC_FIELD에 등록된 테이블은 직전 수집 이후 바뀐 레코드만
 * filterByFormula로 가져와 기존 JSON과 병합하고, 없는 테이블은 매번 전체 재수집한다.
 */
async function fetchTable(
  key: keyof typeof TABLES,
  outName: string,
  fields: string[],
  syncState: SyncState,
  postProcess: (raw: V2Record[]) => V2Record[] = (r) => r
): Promise<V2Record[]> {
  const syncField = SYNC_FIELD[key];
  const since = syncField ? syncState[key] : undefined;

  const formula = since ? `IS_AFTER({${syncField}}, '${since}')` : undefined;
  console.log(`Fetching ${outName}${formula ? ` (증분: ${since} 이후)` : ' (전체)'}...`);

  const rawFields = syncField && !fields.includes(syncField) ? [...fields, syncField] : fields;
  const raw = await fetchAll<V2Record>(TABLES[key], rawFields, formula);
  const processed = postProcess(raw);
  const filtered = stripAndFilter(processed, outName);

  const merged = formula ? mergeById(loadExisting(outName), filtered) : filtered;
  fs.writeFileSync(path.join(OUT_DIR, `${outName}.json`), JSON.stringify(merged, null, 0));

  console.log(
    `${outName}: ${merged.length}건 전체` + (formula ? ` (이번 수집 ${filtered.length}건 반영)` : '')
  );

  if (syncField) syncState[key] = new Date().toISOString();
  return merged;
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const syncState = loadSyncState();

  await fetchTable('인바운드', '인바운드', INBOUND_FIELDS, syncState);
  await fetchTable('SKB', 'SKB', SKB_FIELDS, syncState);
  await fetchTable('레드텔레콤_IB', '레드텔레콤_IB', REDTEL_IB_FIELDS, syncState);
  await fetchTable('레드텔레콤_OB', '레드텔레콤_OB', REDTEL_OB_FIELDS, syncState);
  await fetchTable('정보와기술', '정보와기술', REP_PHONE_FIELDS, syncState, renameRepPhoneFields);

  saveSyncState(syncState);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

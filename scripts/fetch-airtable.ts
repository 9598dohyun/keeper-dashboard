/**
 * SKB+인바운드 통합관리 베이스에서 인바운드·SKB·레드텔레콤 데이터를 가져와 로컬 JSON으로 저장
 * GitHub Actions에서 실행됨 (시간 제한 없음)
 * 개인정보 필드(연락처)는 가져오지 않음
 */
import fs from 'fs';
import path from 'path';
import { V2Record } from '../src/lib/metrics2/types';
import { isTestRecord } from '../src/lib/test-lead';

const TOKEN = process.env.AIRTABLE_TOKEN!;
const BASE_ID = process.env.AIRTABLE_BASE_ID!;
const OUT_DIR = path.join(__dirname, '../data');

const TABLES = {
  인바운드: 'tbljFHOl4PzAWmb1f',
  SKB: 'tblb5APohbhFixfHB',
  레드텔레콤: 'tbll3OcD4C6LGtnDv',
  정보와기술: 'tblfWVIcGWZat5z3g', // 대표전화·채널톡 채널을 함께 다루는 테이블
  레드재컨택: 'tblysBtqXuppj2UTm', // 레드텔레콤 하위 — 인바운드 중복 재컨택 대상
};

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
const REDTEL_FIELDS = ['유입시간']; // 카운트 + 오늘이후 판정용

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
// 레드재컨택 ↔ 레드텔레콤[결제완료] 매칭은 연락처(개인정보)가 필요해 이 스크립트에서
// 다루지 않는다. reconcile.py가 로컬 실행 시 직접 조회해 매칭 결과(건수만)만 남긴다.

type AirtableListResponse<TRecord> = {
  records?: TRecord[];
  offset?: string;
};

async function fetchAll<TRecord>(tableId: string, fields?: string[]): Promise<TRecord[]> {
  const records: TRecord[] = [];
  let offset: string | undefined;

  while (true) {
    const params = new URLSearchParams({ pageSize: '100' });
    if (offset) params.set('offset', offset);
    if (fields) {
      fields.forEach((f) => params.append('fields[]', f));
    }

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

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  console.log('Fetching 인바운드...');
  const inboundRaw = await fetchAll<V2Record>(TABLES.인바운드, INBOUND_FIELDS);
  const inbound = stripAndFilter(inboundRaw, '인바운드');
  fs.writeFileSync(path.join(OUT_DIR, '인바운드.json'), JSON.stringify(inbound, null, 0));
  console.log(`인바운드: ${inbound.length}건`);

  console.log('Fetching SKB...');
  const skbRaw = await fetchAll<V2Record>(TABLES.SKB, SKB_FIELDS);
  const skb = stripAndFilter(skbRaw, 'SKB');
  fs.writeFileSync(path.join(OUT_DIR, 'SKB.json'), JSON.stringify(skb, null, 0));
  console.log(`SKB: ${skb.length}건`);

  console.log('Fetching 레드텔레콤...');
  const redtel = await fetchAll<V2Record>(TABLES.레드텔레콤, REDTEL_FIELDS);
  fs.writeFileSync(path.join(OUT_DIR, '레드텔레콤.json'), JSON.stringify(redtel, null, 0));
  console.log(`레드텔레콤: ${redtel.length}건`);

  console.log('Fetching 정보와기술...');
  const repRaw = await fetchAll<V2Record>(TABLES.정보와기술, REP_PHONE_FIELDS);
  const rep = stripAndFilter(renameRepPhoneFields(repRaw), '정보와기술');
  fs.writeFileSync(path.join(OUT_DIR, '정보와기술.json'), JSON.stringify(rep, null, 0));
  console.log(`정보와기술: ${rep.length}건`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

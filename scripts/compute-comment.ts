/**
 * 일자별 진단 코멘트 생성 → Vercel KV 저장
 *
 * 그날 "응대·결제 실적" 축으로 병목을 짚는다. 유입 코호트 축(compute-diagnosis.ts)과
 * 분모가 다르다 — 당일 유입은 아직 성숙하지 않아 코호트로 보면 늘 0%대로 나온다.
 *
 * 메모 원문은 여기서만 읽고 저장하지 않는다. KV에 남는 건 집계 수치와 요약 문장뿐이다.
 *
 * 저장 키
 *   d3:comment:{YYYY-MM-DD}:{인바운드|skb}
 *
 * 실행: npx tsx scripts/compute-comment.ts --date 2026-09-02
 */
import fs from 'fs';
import path from 'path';
import { kv } from '@vercel/kv';
import { DailyComment, CommentLine } from '../src/lib/metrics3/comment';
import { KV_D3_DAILY_TTL } from '../src/lib/constants';
import { isTestRecord } from '../src/lib/test-lead';

const TOKEN = process.env.AIRTABLE_TOKEN!;
const BASE_ID = process.env.AIRTABLE_BASE_ID!;

interface TableConf {
  id: string;
  이름: string;
  메모: string;
  최종결과: string;
  담당자: string;
  부재중상태: string | null;
}

// 2026-09-30 '인바운드'→'영원' 개명 이후 필드명이 다르다(최종결과·담당자, [콜]부재중 상태 없음)
const TABLES: Record<'인바운드' | 'skb', TableConf> = {
  인바운드: {
    id: 'tbl8NencTcDnVDWy6',
    이름: '고객명',
    메모: '메모텍스트',
    최종결과: '최종결과',
    담당자: '담당자',
    부재중상태: null,
  },
  skb: {
    id: 'tblb5APohbhFixfHB',
    이름: '이름',
    메모: '[콜]메모 관리',
    최종결과: '[콜]최종 결과',
    담당자: '[콜]담당자',
    부재중상태: '[콜]부재중 상태',
  },
};
type TableKey = keyof typeof TABLES;

const COMMON_FIELDS = ['유입시간', '메모수정시각', '첫응대시각', '실패사유', '실패상세이유', 'UTM_source'];

interface Rec {
  id: string;
  fields: Record<string, string | boolean | number | undefined>;
}

/**
 * 베이스 전체 테이블의 필드명 스키마를 메타 API로 한 번만 가져와 캐시한다.
 *
 * 레코드 응답으로 필드 존재를 검증하면 오탐이 난다 — 에어테이블은 값이 빈 필드를
 * 레코드 JSON에서 아예 생략하므로, 필드가 실제로 있어도 샘플 레코드엔 안 보일 수 있다
 * (2026-10-02 확인: `실패상세이유`는 스키마엔 있지만 당일 레코드가 전부 비어 있어
 * 레코드 기반 검증이 "없는 필드"로 오판했다). 그래서 스키마 자체를 조회해 대조한다.
 */
let schemaCache: Map<string, Set<string>> | null = null;
async function loadSchema(): Promise<Map<string, Set<string>>> {
  if (schemaCache) return schemaCache;
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error(`Airtable meta API error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { tables: { id: string; fields: { name: string }[] }[] };
  schemaCache = new Map(data.tables.map((t) => [t.id, new Set(t.fields.map((f) => f.name))]));
  return schemaCache;
}

/**
 * 요청한 필드명이 실제로 에어테이블 스키마에 존재하는지 확인한다.
 *
 * 에어테이블 API는 존재하지 않는 필드명을 fields[]로 요청해도 에러 없이 그냥 빼버린다 —
 * 필드명이 바뀌면(예: 2026-09-30 '인바운드'→'영원' 개명) 코멘트가 전부 빈 채로 조용히
 * 생성된다. 요청 직전에 스키마와 대조해 바로 에러를 낸다.
 */
async function assertFieldsExist(tableId: string, fields: string[]) {
  const schema = await loadSchema();
  const present = schema.get(tableId);
  if (!present) throw new Error(`테이블 ID ${tableId}를 메타 API 스키마에서 찾지 못했습니다.`);
  const missing = fields.filter((f) => !present.has(f));
  if (missing.length > 0) {
    throw new Error(
      `${tableId}: 요청한 필드가 에어테이블 스키마에 없습니다 — 필드명이 바뀌었을 수 있습니다.\n` +
        `  없는 필드: ${missing.join(', ')}\n` +
        `  에어테이블 메타 API로 현재 스키마를 확인하세요: ` +
        `GET https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`
    );
  }
}

async function fetchAll(tableId: string, fields: string[]): Promise<Rec[]> {
  await assertFieldsExist(tableId, fields);
  const out: Rec[] = [];
  let offset: string | undefined;
  for (;;) {
    const p = new URLSearchParams({ pageSize: '100' });
    if (offset) p.set('offset', offset);
    fields.forEach((f) => p.append('fields[]', f));
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${tableId}?${p}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) throw new Error(`Airtable ${res.status} ${await res.text()}`);
    const d = (await res.json()) as { records?: Rec[]; offset?: string };
    out.push(...(d.records ?? []));
    offset = d.offset;
    if (!offset) break;
    await new Promise((r) => setTimeout(r, 220));
  }
  return out;
}

/** UTC 문자열 → KST 날짜 YYYY-MM-DD */
function kstDate(s: unknown): string | null {
  if (typeof s !== 'string' || !s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function hoursBetween(a: unknown, b: unknown): number | null {
  if (typeof a !== 'string' || typeof b !== 'string') return null;
  const x = new Date(a).getTime();
  const y = new Date(b).getTime();
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  return (y - x) / 3600000;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function pct(n: number, d: number): number {
  return d ? Math.round((n / d) * 1000) / 10 : 0;
}

/**
 * 메모 원문을 주제로 분류한다. 원문은 반환하지 않는다.
 *
 * 실제 9/2 메모에서 반복 확인된 표현만 넣었다. 새 표현이 보이면 여기 추가한다.
 */
const 주제사전: { 키: string; 말: RegExp }[] = [
  { 키: '결제수단 마찰', 말: /결제수단|일시불|카드.{0,4}(부담|싫|어렵|없)|신카없|계좌이체|무이자|kb페이|페이.{0,3}(결제)?어렵|결제.{0,6}(진행|안됨|어려)|결제링크|할부/i },
  { 키: '내부 의사결정 대기', 말: /회의|의논|상의|승인|대표님|가족|부모님|딸|남편|아내|직원인데/ },
  { 키: '가격 부담', 말: /가격.{0,4}(부담|비싸)|저가형|비용부담|견적.{0,3}부담/ },
  { 키: '견적서 요청', 말: /견적서|견적문자|서면요청/ },
  { 키: '재연락 약속', 말: /재연락|다시.{0,4}연락|연락.{0,4}(주|드리)|나중에|차후|이번주|다음주|내일|추후/ },
  { 키: '부재중', 말: /부재\s*\d|부재중|촉구문자|촉구연락|팔로업/ },
  { 키: '상담 거부', 말: /상담거부|화내|끊어|끊음|연락거부/ },
  { 키: '경쟁사·기구매', 말: /타회사|타사|경쟁|이미.{0,4}(구매|설치)|구매.{0,2}했|설치했/ },
  { 키: '설치·현장 확인', 말: /실사|현장|층고|배선|설치불가|인터넷설치/ },
];

function 주제분류(memo: string): string[] {
  const hit: string[] = [];
  for (const t of 주제사전) if (t.말.test(memo)) hit.push(t.키);
  return hit;
}

/**
 * 결제 판정 소스 = 결제 데이터 엑셀 대조 결과.
 *
 * 에어테이블 `[콜]최종 결과`가 '결제 완료'여도 엑셀에 없으면 결제로 세지 않는다.
 * 대조 결과의 기준일이 코멘트 기준일과 다르면 쓰지 않는다(다른 날 결제를 섞지 않기 위함).
 */
function loadPaidIds(
  day: string
): { 인바운드: Set<string>; skb: Set<string>; 건수_인바운드: number; 건수_SKB: number } | null {
  const p = path.join(__dirname, '../data/결제대조.json');
  if (!fs.existsSync(p)) return null;
  const j = JSON.parse(fs.readFileSync(p, 'utf8')) as {
    기준일?: string;
    결제ID_인바운드?: string[];
    결제ID_SKB?: string[];
    결제건수_인바운드?: number;
    결제건수_SKB?: number;
  };
  if (j.기준일 !== day) return null;
  return {
    인바운드: new Set(j.결제ID_인바운드 ?? []),
    skb: new Set(j.결제ID_SKB ?? []),
    // 결제ID_*(레코드ID 집합)는 같은 리드가 여러 주문(같은 날 재구매·증설 등)의 대표로 뽑히면
    // 실제 주문 건수보다 작아진다 — "그날 결제 전체" 표시는 정확한 결제건수_*를 쓴다.
    건수_인바운드: j.결제건수_인바운드 ?? (j.결제ID_인바운드 ?? []).length,
    건수_SKB: j.결제건수_SKB ?? (j.결제ID_SKB ?? []).length,
  };
}

function 인자(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

/** 테이블별 원본 필드명을 표준 필드명('[콜]최종 결과'·'[콜]담당자'·'[콜]부재중 상태')으로 리네임 */
function toStandardFields(table: TableKey, recs: Rec[]): Rec[] {
  const conf = TABLES[table];
  if (conf.최종결과 === '[콜]최종 결과' && conf.담당자 === '[콜]담당자') return recs;
  return recs.map((r) => {
    const f = { ...r.fields };
    f['[콜]최종 결과'] = f[conf.최종결과];
    f['[콜]담당자'] = f[conf.담당자];
    if (conf.부재중상태) f['[콜]부재중 상태'] = f[conf.부재중상태];
    return { id: r.id, fields: f };
  });
}

async function build(
  table: TableKey,
  day: string,
  paidIds: Set<string> | null,
  결제전체: number
): Promise<DailyComment> {
  const conf = TABLES[table];
  const fields = [
    ...COMMON_FIELDS,
    conf.이름,
    conf.메모,
    conf.최종결과,
    conf.담당자,
    ...(conf.부재중상태 ? [conf.부재중상태] : []),
  ];
  const raw = await fetchAll(conf.id, fields);
  const recs = toStandardFields(table, raw);
  const hit = recs.filter((r) => {
    const ts = r.fields['메모수정시각'];
    // 2026-09-30 '인바운드'→'영원' 개명 작업 중 2026-10-01T02:30대에 11,256건이
    // 일괄 터치되어 메모수정시각이 찍혔다(실제 응대 아님) — 그 배치만 제외한다.
    if (typeof ts === 'string' && ts.startsWith('2026-10-01T02:30')) return false;
    return !isTestRecord(r.fields) && kstDate(ts) === day;
  });

  const 응대 = hit.length;
  const 결과 = (r: Rec) => str(r.fields['[콜]최종 결과']);
  /** 엑셀 대조 결과가 있으면 그것만 믿는다. 없으면 에어테이블 최종 결과로 폴백 */
  const 결제여부 = (r: Rec) => (paidIds ? paidIds.has(r.id) : 결과(r).includes('결제 완료'));
  const 결제 = hit.filter(결제여부).length;
  const 실패건 = hit.filter((r) => 결과(r) === '실패');
  const 부재중 = hit.filter((r) => 결과(r).includes('부재중')).length;
  const 미확정 = hit.filter((r) => !결과(r)).length;

  const lines: CommentLine[] = [];

  // --- 사람 축 ---
  const byOwner = new Map<string, { n: number; paid: number }>();
  for (const r of hit) {
    const k = str(r.fields['[콜]담당자']) || '(미배정)';
    const v = byOwner.get(k) ?? { n: 0, paid: 0 };
    v.n++;
    if (결제여부(r)) v.paid++;
    byOwner.set(k, v);
  }
  const owners = [...byOwner.entries()].sort((a, b) => b[1].n - a[1].n);
  if (owners.length === 1 && 응대 >= 30) {
    lines.push({
      축: '사람',
      본문: `그날 응대 전량을 ${owners[0][0]} 1명이 처리했다. 이 인원이 빠지면 그날 응대가 통째로 멈추는 구조다.`,
      근거: [`${owners[0][0]} ${owners[0][1].n}건 (100%)`, `결제 ${owners[0][1].paid}건`],
    });
  } else if (owners.length > 1) {
    const top = owners[0];
    const share = pct(top[1].n, 응대);
    if (share >= 60) {
      lines.push({
        축: '사람',
        본문: `응대가 ${top[0]}에게 몰려 있다. 처리량 대비 결제 성과를 같이 봐야 과부하인지 판단할 수 있다.`,
        근거: [
          `${top[0]} ${top[1].n}건 (${share}%)`,
          `결제 ${top[1].paid}건`,
          `나머지 ${owners.length - 1}명 ${응대 - top[1].n}건`,
        ],
      });
    }
  }

  // --- 응대속도 축 (유입 → 첫응대) ---
  const lt = hit
    .map((r) => hoursBetween(r.fields['유입시간'], r.fields['첫응대시각']))
    .filter((v): v is number => v !== null && v >= 0);
  if (lt.length >= 10) {
    const med = Math.round(median(lt) * 10) / 10;
    const over24 = lt.filter((v) => v > 24).length;
    if (med >= 3 || over24 > 0) {
      lines.push({
        축: '응대속도',
        본문:
          med >= 3
            ? `유입 후 첫 통화까지 중앙값 ${med}시간이 걸린다. 당일 유입을 당일에 못 받는 구간이 있다.`
            : `대부분은 빠르게 받지만 24시간을 넘긴 건이 남아 있다.`,
        근거: [`첫응대 중앙 ${med}시간`, `24시간 초과 ${over24}건`, `측정 ${lt.length}건`],
      });
    }
  }

  // --- 재컨택 축 (그날 응대한 리드가 언제 유입됐나) ---
  const 신규 = hit.filter((r) => kstDate(r.fields['유입시간']) === day).length;
  const 재컨택 = 응대 - 신규;
  if (응대 >= 20) {
    const 재pct = pct(재컨택, 응대);
    if (재pct < 20) {
      lines.push({
        축: '재컨택',
        본문: `그날 응대가 신규 유입에 쏠려 있다. 앞서 미확정으로 남은 건을 다시 건드리지 못하고 있어 적체가 뒤로 밀린다.`,
        근거: [`신규 ${신규}건 (${pct(신규, 응대)}%)`, `재컨택 ${재컨택}건 (${재pct}%)`],
      });
    } else if (재pct >= 50) {
      lines.push({
        축: '재컨택',
        본문: `그날 응대의 절반 이상이 과거 유입분 재컨택이다. 적체를 소화하는 중이라 신규 유입 응대가 밀릴 수 있다.`,
        근거: [`재컨택 ${재컨택}건 (${재pct}%)`, `신규 ${신규}건`, `결제 ${결제}건`],
      });
    }
  }

  // --- 유입채널 축 ---
  const byCh = new Map<string, { n: number; paid: number }>();
  for (const r of hit) {
    const k = str(r.fields['UTM_source']) || '(미확인)';
    const v = byCh.get(k) ?? { n: 0, paid: 0 };
    v.n++;
    if (결제여부(r)) v.paid++;
    byCh.set(k, v);
  }
  const chs = [...byCh.entries()].filter(([, v]) => v.n >= 10).sort((a, b) => b[1].n - a[1].n);
  const 무결제 = chs.filter(([, v]) => v.paid === 0);
  if (무결제.length && chs.length > 1) {
    const w = 무결제.sort((a, b) => b[1].n - a[1].n)[0];
    lines.push({
      축: '유입채널',
      본문: `${w[0]} 채널은 응대 물량은 나오는데 그날 결제로 이어진 건이 없다. 리드 품질인지 응대 방식인지 갈라 볼 필요가 있다.`,
      근거: [
        `${w[0]} 응대 ${w[1].n}건 · 결제 0건`,
        ...chs
          .filter(([k, v]) => k !== w[0] && v.paid > 0)
          .slice(0, 1)
          .map(([k, v]) => `${k} ${v.n}건 · 결제 ${v.paid}건`),
      ],
    });
  }

  // --- 실패사유 + 메모 주제 ---
  const 사유 = new Map<string, number>();
  for (const r of 실패건) {
    const k = str(r.fields['실패사유']) || '(미기재)';
    사유.set(k, (사유.get(k) ?? 0) + 1);
  }
  const 사유순 = [...사유.entries()].sort((a, b) => b[1] - a[1]);

  // 메모 주제 — 미확정(아직 안 끝난) 건에서 무엇이 걸려 있는지
  const 주제 = new Map<string, number>();
  let 메모검토 = 0;
  for (const r of hit) {
    const memo = str(r.fields[conf.메모]).trim();
    if (!memo) continue;
    메모검토++;
    if (결과(r)) continue; // 미확정 건만 — 진행 중 마찰을 본다
    for (const t of 주제분류(memo)) 주제.set(t, (주제.get(t) ?? 0) + 1);
  }
  const 주제순 = [...주제.entries()]
    .filter(([k]) => k !== '부재중' && k !== '재연락 약속')
    .sort((a, b) => b[1] - a[1]);

  if (사유순.length) {
    const top = 사유순[0];
    const 근거 = [`실패 ${실패건.length}건`, `${top[0]} ${top[1]}건 (${pct(top[1], 실패건.length)}%)`];
    if (사유순[1]) 근거.push(`${사유순[1][0]} ${사유순[1][1]}건`);
    lines.push({
      축: '실패사유',
      본문: `그날 실패는 ${top[0]}에 몰려 있다.`,
      근거,
    });
  }

  if (주제순.length) {
    const t1 = 주제순[0];
    const 근거 = [`미확정 ${미확정}건`, `${t1[0]} ${t1[1]}건`];
    if (주제순[1]) 근거.push(`${주제순[1][0]} ${주제순[1][1]}건`);
    lines.push({
      축: '실패사유',
      본문: `아직 안 끝난 건의 메모를 보면 ${t1[0]}${주제순[1] ? `·${주제순[1][0]}` : ''}에 걸려 있다. 여기가 풀리면 넘어올 수 있는 물량이다.`,
      근거,
    });
  }

  return {
    날짜: day,
    테이블: table,
    실적: { 응대, 결제, 결제_전체: 결제전체, 실패: 실패건.length, 부재중 },
    라인: lines,
    meta: { updatedAt: new Date().toISOString(), 메모검토 },
  };
}

async function main() {
  const day = 인자('--date');
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error('--date YYYY-MM-DD 로 기준일을 지정해 주세요.');
  }
  const dry = process.argv.includes('--dry');

  const paid = loadPaidIds(day);
  console.log(
    paid
      ? `결제 소스: 결제대조.json (인바운드 ${paid.건수_인바운드} · SKB ${paid.건수_SKB})`
      : '결제 소스: 에어테이블 [콜]최종 결과 (해당 기준일 결제대조.json 없음)'
  );

  const 결제전체 = { 인바운드: paid?.건수_인바운드, skb: paid?.건수_SKB };
  for (const table of ['인바운드', 'skb'] as TableKey[]) {
    const c = await build(
      table,
      day,
      paid ? paid[table] : null,
      paid ? (결제전체[table] ?? 0) : 0
    );
    console.log(`\n===== ${table} ${day} =====`);
    console.log(
      `응대 ${c.실적.응대} / 결제 ${c.실적.결제} (그날 결제 전체 ${c.실적.결제_전체}) / ` +
        `실패 ${c.실적.실패} / 부재중 ${c.실적.부재중} (메모 검토 ${c.meta.메모검토}건)`
    );
    for (const l of c.라인) console.log(`  [${l.축}] ${l.본문}\n      ${l.근거.join(' · ')}`);
    if (!dry) {
      await kv.set(`d3:comment:${day}:${table}`, c, { ex: KV_D3_DAILY_TTL });
      console.log('  → KV 저장');
    }
  }
  if (dry) console.log('\n(--dry: KV 저장 안 함)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

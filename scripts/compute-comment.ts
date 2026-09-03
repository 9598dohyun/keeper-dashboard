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
import {
  DailyComment,
  CommentLine,
  PaidTrace,
  PaidTracking,
} from '../src/lib/metrics3/comment';
import { KV_D3_DAILY_TTL } from '../src/lib/constants';
import { isTestRecord } from '../src/lib/test-lead';

const TOKEN = process.env.AIRTABLE_TOKEN!;
const BASE_ID = process.env.AIRTABLE_BASE_ID!;

const TABLES = {
  인바운드: { id: 'tbljFHOl4PzAWmb1f', 이름: '고객명', 메모: '메모 텍스트' },
  skb: { id: 'tblb5APohbhFixfHB', 이름: '이름', 메모: '[콜]메모 관리' },
} as const;
type TableKey = keyof typeof TABLES;

const BASE_FIELDS = [
  '유입시간',
  '메모수정시각',
  '첫응대시각',
  '[콜]최종 결과',
  '[콜]담당자',
  '실패사유',
  '실패상세이유',
  '[콜]부재중 상태',
  'UTM_source',
];

interface Rec {
  id: string;
  fields: Record<string, string | boolean | number | undefined>;
}

async function fetchAll(tableId: string, fields: string[]): Promise<Rec[]> {
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
function loadPaidIds(day: string): { 인바운드: Set<string>; skb: Set<string> } | null {
  const p = path.join(__dirname, '../data/결제대조.json');
  if (!fs.existsSync(p)) return null;
  const j = JSON.parse(fs.readFileSync(p, 'utf8')) as {
    기준일?: string;
    결제ID_인바운드?: string[];
    결제ID_SKB?: string[];
  };
  if (j.기준일 !== day) return null;
  return {
    인바운드: new Set(j.결제ID_인바운드 ?? []),
    skb: new Set(j.결제ID_SKB ?? []),
  };
}

/**
 * 그날 결제 전수 추적.
 *
 * 원장은 결제일로 묶여 있어 그날 결제된 주문 전부를 집을 수 있다. 각 주문에 붙은
 * 리드 ID로 유입일을 찾아 소요일을 낸다. 리드가 없는 건(오가닉·아웃바운드 등)은
 * 유입일을 알 수 없어 미매칭으로 남기되, 건수에서 빼지 않는다 — 빼면 그날 결제
 * 총량이 화면에서 사라진다.
 */
function buildTracking(day: string, 유입일: Map<string, string>): PaidTracking | null {
  const p = path.join(__dirname, '../data/결제원장.json');
  if (!fs.existsSync(p)) return null;
  const led = JSON.parse(fs.readFileSync(p, 'utf8')) as {
    주문?: Record<
      string,
      {
        결제일?: string | null;
        취소?: boolean;
        채널?: string;
        인바운드ID?: string[];
        skbID?: string[];
      }
    >;
  };

  const 건: PaidTrace[] = [];
  for (const o of Object.values(led.주문 ?? {})) {
    if (o.취소 || o.결제일 !== day) continue;
    const ib = o.인바운드ID ?? [];
    const sk = o.skbID ?? [];
    const 테이블: PaidTrace['테이블'] = ib.length ? '인바운드' : sk.length ? 'SKB' : '미매칭';
    const id = ib[0] ?? sk[0];
    const ing = id ? (유입일.get(id) ?? null) : null;
    건.push({
      채널: o.채널 || '(없음)',
      테이블,
      유입일: ing,
      소요일: ing ? Math.round((Date.parse(day) - Date.parse(ing)) / 86400000) : null,
    });
  }
  if (!건.length) return null;

  const lags = 건.map((x) => x.소요일).filter((v): v is number => v !== null);
  const ch = new Map<string, number>();
  for (const x of 건) ch.set(x.채널, (ch.get(x.채널) ?? 0) + 1);

  건.sort((a, b) => (b.소요일 ?? -Infinity) - (a.소요일 ?? -Infinity));

  return {
    주문: 건.length,
    매칭: 건.filter((x) => x.테이블 !== '미매칭').length,
    미매칭: 건.filter((x) => x.테이블 === '미매칭').length,
    당일결제: 건.filter((x) => x.소요일 === 0).length,
    소요일_중앙: lags.length ? Math.round(median(lags)) : null,
    소요일_최대: lags.length ? Math.max(...lags) : null,
    채널별: [...ch.entries()]
      .map(([채널, 건수]) => ({ 채널, 건수 }))
      .sort((a, b) => b.건수 - a.건수),
    건,
  };
}

function 인자(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function build(
  table: TableKey,
  day: string,
  paidIds: Set<string> | null,
  결제전체: number,
  유입일수집: Map<string, string>
): Promise<DailyComment> {
  const conf = TABLES[table];
  const recs = await fetchAll(conf.id, [...BASE_FIELDS, conf.이름, conf.메모]);
  // 결제 추적에서 리드ID → 유입일을 찾는 데 쓴다 (테이블 두 곳을 합쳐 하나의 맵으로)
  for (const r of recs) {
    const d = kstDate(r.fields['유입시간']);
    if (d) 유입일수집.set(r.id, d);
  }
  const hit = recs.filter(
    (r) => !isTestRecord(r.fields) && kstDate(r.fields['메모수정시각']) === day
  );

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
    결제추적: null, // main 에서 두 테이블 수집이 끝난 뒤 채운다
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
      ? `결제 소스: 결제대조.json (인바운드 ${paid.인바운드.size} · SKB ${paid.skb.size})`
      : '결제 소스: 에어테이블 [콜]최종 결과 (해당 기준일 결제대조.json 없음)'
  );

  /*
   * 결제 추적은 두 테이블을 합쳐 계산한다. 그날 결제된 주문은 인바운드·SKB 어느 쪽
   * 리드에도 붙을 수 있고, 아예 안 붙기도 한다(오가닉 등). 테이블별로 쪼개면 그날
   * 결제 총량이 화면에서 갈라져 "오늘 몇 건 결제됐나"를 답할 수 없다.
   */
  const 유입일 = new Map<string, string>();
  const built: Record<string, DailyComment> = {};

  for (const table of ['인바운드', 'skb'] as TableKey[]) {
    built[table] = await build(
      table,
      day,
      paid ? paid[table] : null,
      paid ? paid[table].size : 0,
      유입일
    );
  }

  const tracking = buildTracking(day, 유입일);
  if (tracking) {
    console.log(
      `\n[그날 결제 추적] 주문 ${tracking.주문}건 (매칭 ${tracking.매칭} / 미매칭 ${tracking.미매칭}) · ` +
        `당일결제 ${tracking.당일결제}건 · 소요일 중앙 ${tracking.소요일_중앙} / 최대 ${tracking.소요일_최대}`
    );
    console.log(
      '  채널별: ' + tracking.채널별.map((c) => `${c.채널} ${c.건수}`).join(' · ')
    );
  }

  /*
   * 결제 리드타임 코멘트 — 그날 결제가 그날 유입에서 나오지 않는다는 사실을 짚는다.
   * 이걸 안 적으면 화면의 유입 코호트 결제수(9/2: 1건)를 그날 성과로 오독한다.
   */
  const 추적라인: CommentLine[] = [];
  if (tracking && tracking.주문 >= 5) {
    const 당일pct = pct(tracking.당일결제, tracking.주문);
    if (당일pct < 50) {
      추적라인.push({
        축: '결제리드타임',
        본문:
          `그날 결제 ${tracking.주문}건 중 당일 유입에서 바로 나온 건은 ${tracking.당일결제}건뿐이다. ` +
          `나머지는 과거 유입분이 뒤늦게 결제된 것이라, 그날 유입만 보면 성과가 실제보다 작아 보인다.`,
        근거: [
          `당일결제 ${tracking.당일결제}건 (${당일pct}%)`,
          `소요일 중앙 ${tracking.소요일_중앙}일`,
          `최대 ${tracking.소요일_최대}일`,
        ],
      });
    }
  }

  for (const table of ['인바운드', 'skb'] as TableKey[]) {
    const c = built[table];
    c.결제추적 = tracking;
    c.라인 = [...추적라인, ...c.라인];
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

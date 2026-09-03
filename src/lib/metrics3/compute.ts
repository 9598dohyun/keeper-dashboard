/**
 * 전환율 진단 지표 계산
 *
 * metrics2와의 차이: 모든 지표가 '유입시간' 기준이다.
 * metrics2는 Last Modified 기준 당일 성과를 보고, 이 엔진은 유입 코호트의 처리 상태를 본다.
 * 두 화면의 전환율은 분모가 다르므로 서로 비교하면 안 된다.
 */
import { parseUTC, toKST, formatDate } from '../metrics/biz-date';
import { isPaid } from '../metrics2/status';
import { utmSourceOf, entryPathOf, crossKeyOf } from './source';
import { timeSegmentOf, SEGMENT_ORDER } from './time-segment';
import {
  isUnresolved,
  isExcludedFromStale,
  staleBucketOf,
  isActionableBucket,
  STALE_BUCKET_ORDER,
  STALE_THRESHOLD_DAYS,
} from './stale';
import {
  D3Record,
  ConversionStat,
  SegmentRow,
  StaleLead,
  StaleBucketStat,
  LeadTimeStat,
  LeadTimeBucket,
  FailReasonRow,
  DiagnosisTable,
  재컨택Stat,
} from './types';

/** 첫응대시각 에어테이블 자동화 적용일. 이전 유입분은 리드타임 측정 불가 */
export const LEADTIME_START = '2026-08-11';

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

function kstOf(s: string | undefined): Date | null {
  const dt = parseUTC(s);
  return dt ? toKST(dt) : null;
}

/** 두 시각의 일 단위 차이 (달력일 기준) */
function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

/**
 * 결제 판정.
 *
 * 결제 여부의 진짜 소스는 결제 데이터 엑셀이다. 다만 원장은 엑셀을 받은 날부터 쌓이므로
 * 그 이전 유입분까지 엑셀 기준으로 세면 과거 결제가 통째로 누락된다(90일 결제 312 → 22).
 *
 * 그래서 **원장이 덮는 기간에 유입된 리드만** 엑셀 기준으로 판정하고,
 * 그 이전 유입분은 기존대로 에어테이블 최종결과를 쓴다.
 * 전체 기간 엑셀을 --all 로 한 번 넣으면 커버 범위가 과거까지 넓어져 전부 엑셀 기준이 된다.
 */
function paidOf(r: D3Record, ctx: PaidContext): boolean {
  if (ctx.ids) {
    const d = kstOf(r.fields['유입시간']);
    const day = d ? formatDate(d) : null;
    if (day !== null && (ctx.since === null || day >= ctx.since)) {
      return ctx.ids.has(r.id);
    }
  }
  return isPaid(r.fields['[콜]최종 결과']);
}

/** 결제 판정에 필요한 것 — 원장 ID와 원장이 덮기 시작하는 날 */
export interface PaidContext {
  ids: Set<string> | null;
  /** 이 날짜 이후 유입분만 원장으로 판정. null이면 전체 기간 */
  since: string | null;
  /** 리드ID → 결제일(YYYY-MM-DD). 첫상담/재상담 분해에 쓴다. 없으면 분해 불가 */
  payDates?: Map<string, string> | null;
}

/**
 * 재컨택 분해 — 그날 접촉된 건을 신규 / 재컨택으로 가른다.
 *
 * 기준 (2026-09-03 확정):
 *   - 그날 `메모수정시각`이 찍힌 건 = 그날 접촉된 건
 *   - 그중 유입일이 그날이 아니면 **재컨택**, 유입일도 그날이면 **신규**
 *   - `첫응대시각`이 그날보다 앞서면 이미 응대한 뒤 다시 접촉한 것이므로,
 *     유입일이 그날이어도 재컨택으로 본다 (당일 유입·당일 첫응대 후 재접촉)
 *   - `메모수정시각`이 비면 **미컨택** — 접촉 분해 대상이 아니라 따로 센다
 *
 * 하루 단위에서만 의미가 있다. 여러 날을 묶으면 "그날"이 정해지지 않아 null을 준다.
 */
function 재컨택Of(
  records: D3Record[],
  opts: { day: string | null; since: string; until: string }
): 재컨택Stat | null {
  const { day, since, until } = opts;
  if (!day) return null;

  let 신규 = 0;
  let 재컨택 = 0;
  let 미컨택 = 0;
  let 유입 = 0;
  const 경과일: number[] = [];
  const [dy, dm, dd] = day.split('-').map(Number);
  const 기준 = new Date(dy, dm - 1, dd);

  for (const r of records) {
    const ing = kstOf(r.fields['유입시간']);
    const ingDay = ing ? formatDate(ing) : null;

    // 미컨택 — 기간 내 유입분 중 아직 메모가 없는 건
    if (ingDay !== null && ingDay >= since && ingDay <= until && !r.fields['메모수정시각']) {
      미컨택++;
    }
    if (ingDay !== null && ingDay >= since && ingDay <= until) 유입++;

    const memo = kstOf(r.fields['메모수정시각']);
    if (!memo || formatDate(memo) !== day) continue;

    const 첫응대 = kstOf(r.fields['첫응대시각']);
    const 첫응대일 = 첫응대 ? formatDate(첫응대) : null;
    // 유입이 과거이거나, 이미 앞선 날에 응대한 뒤 다시 접촉한 건 → 재컨택
    if (ingDay !== day || (첫응대일 !== null && 첫응대일 < day)) {
      재컨택++;
      if (ing) 경과일.push(daysBetween(ing, 기준));
    } else {
      신규++;
    }
  }

  경과일.sort((a, b) => a - b);
  const mid = 경과일.length >> 1;
  const 중앙 = 경과일.length
    ? 경과일.length % 2
      ? 경과일[mid]
      : Math.round((경과일[mid - 1] + 경과일[mid]) / 2)
    : null;
  const 접촉 = 신규 + 재컨택;

  return {
    접촉,
    신규,
    재컨택,
    재컨택률_pct: pct(재컨택, 접촉),
    재컨택_경과일_중앙: 중앙,
    재컨택_경과일_최대: 경과일.length ? 경과일[경과일.length - 1] : null,
    미컨택,
    미컨택률_pct: pct(미컨택, 유입),
  };
}

function conversionOf(records: D3Record[], paid: PaidContext): ConversionStat {
  const 유입 = records.length;
  let 결제 = 0;
  let 미확정 = 0;
  for (const r of records) {
    if (paidOf(r, paid)) 결제++;
    if (isUnresolved(r)) 미확정++;
  }
  const 종결 = 유입 - 미확정;
  return {
    유입,
    결제,
    미확정,
    유입대비_pct: pct(결제, 유입),
    종결대비_pct: pct(결제, 종결),
    미확정률_pct: pct(미확정, 유입),
  };
}

/** 세그먼트 1그룹의 행 생성 */
function segmentRowOf(
  key: string,
  records: D3Record[],
  today: Date,
  paid: PaidContext
): SegmentRow {
  const base = conversionOf(records, paid);
  let 방치 = 0;
  let 경과합 = 0;
  let 미확정수 = 0;
  for (const r of records) {
    if (!isUnresolved(r) || isExcludedFromStale(r)) continue;
    const inflow = kstOf(r.fields['유입시간']);
    if (!inflow) continue;
    const d = daysBetween(inflow, today);
    미확정수++;
    경과합 += d;
    if (d >= STALE_THRESHOLD_DAYS) 방치++;
  }
  return {
    key,
    ...base,
    방치_15일: 방치,
    평균경과일: 미확정수 > 0 ? Math.round((경과합 / 미확정수) * 10) / 10 : 0,
  };
}

function groupBy(records: D3Record[], keyFn: (r: D3Record) => string) {
  const map = new Map<string, D3Record[]>();
  for (const r of records) {
    const k = keyFn(r);
    const cur = map.get(k);
    if (cur) cur.push(r);
    else map.set(k, [r]);
  }
  return map;
}

function leadTimeBucketOf(hours: number): LeadTimeBucket {
  if (hours <= 0.5) return '0-30분';
  if (hours <= 1) return '30분-1시간';
  if (hours <= 3) return '1-3시간';
  if (hours <= 12) return '3-12시간';
  if (hours <= 24) return '12-24시간';
  return '1일+';
}

const LEADTIME_ORDER: LeadTimeBucket[] = [
  '0-30분',
  '30분-1시간',
  '1-3시간',
  '3-12시간',
  '12-24시간',
  '1일+',
];

/**
 * 리드타임 집계
 *
 * 신규 유입분과 적체 소화분을 분리한다.
 * 자동화 적용 시점에 과거 유입 건이 뒤늦게 첫응대되면 경과가 수백~수천 시간으로 잡혀
 * 합산 시 평균이 왜곡된다 (2026-08-11 확인: 06-30 유입 건이 08-11 첫응대 = 1,007시간).
 */
function computeLeadTime(records: D3Record[]): LeadTimeStat[] {
  const acc = new Map<LeadTimeBucket, { 신규: number; 적체: number }>();
  for (const b of LEADTIME_ORDER) acc.set(b, { 신규: 0, 적체: 0 });

  for (const r of records) {
    const inflow = kstOf(r.fields['유입시간']);
    const first = kstOf(r.fields['첫응대시각']);
    if (!inflow || !first) continue;
    const hours = (first.getTime() - inflow.getTime()) / 3600000;
    if (hours < 0) continue; // 데이터 이상치
    const bucket = leadTimeBucketOf(hours);
    const cur = acc.get(bucket)!;
    // 유입 당일 또는 익일 응대 = 신규 유입분, 그 이전 유입을 뒤늦게 처리 = 적체 소화분
    if (daysBetween(inflow, first) <= 1) cur.신규++;
    else cur.적체++;
  }

  return LEADTIME_ORDER.map((b) => ({
    버킷: b,
    신규유입분: acc.get(b)!.신규,
    적체소화분: acc.get(b)!.적체,
  }));
}

function computeFailReasons(records: D3Record[], paid: PaidContext): {
  rows: FailReasonRow[];
  기재: number;
  실패총건: number;
} {
  // 실패 = 결과가 있고, 결제·중복문의·B2B가 아닌 것
  const 실패건 = records.filter((r) => {
    const f = r.fields['[콜]최종 결과'];
    if (!f || f.trim() === '') return false;
    if (paidOf(r, paid)) return false;
    return f !== '중복문의' && f !== 'B2B';
  });
  const withReason = 실패건.filter((r) => r.fields['실패사유']);
  const map = new Map<string, number>();
  for (const r of withReason) {
    const k = r.fields['실패사유']!.trim();
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  const total = withReason.length;
  const rows = [...map.entries()]
    .map(([사유, 건수]) => ({ 사유, 건수, 비중_pct: pct(건수, total) }))
    .sort((a, b) => b.건수 - a.건수);
  return { rows, 기재: total, 실패총건: 실패건.length };
}

/** 방치 리드 목록 — 경과일 내림차순 (오래 방치된 것부터) */
function computeStaleLeads(records: D3Record[], today: Date, limit: number): StaleLead[] {
  const out: StaleLead[] = [];
  for (const r of records) {
    if (!isUnresolved(r) || isExcludedFromStale(r)) continue;
    const inflow = kstOf(r.fields['유입시간']);
    if (!inflow) continue;
    const days = daysBetween(inflow, today);
    out.push({
      id: r.id,
      유입일: formatDate(inflow),
      경과일: days,
      버킷: staleBucketOf(days),
      시간대: timeSegmentOf(inflow),
      매체: utmSourceOf(r),
      유입페이지: entryPathOf(r),
      담당자: r.fields['[콜]담당자']?.trim() || '(미배정)',
      부재중상태: r.fields['[콜]부재중 상태']?.trim() || '-',
      온도감: r.fields['[콜]온도감']?.trim() || '-',
    });
  }
  return out.sort((a, b) => b.경과일 - a.경과일).slice(0, limit);
}

export interface ComputeOptions {
  /** 집계 기준일 (KST). 경과일 계산의 기준 */
  today: Date;
  /** 유입시간이 이 날짜 이후인 리드만 (YYYY-MM-DD) */
  since: string;
  /** 유입시간이 이 날짜 이하인 리드만 (YYYY-MM-DD). 주별·월별처럼 끝이 닫힌 기간에 쓴다 */
  until?: string;
  /** 방치 리드 목록 최대 건수 */
  staleLimit?: number;
  /**
   * 결제 판정 소스 — 결제 데이터 엑셀 원장.
   * 생략하면 에어테이블 [콜]최종 결과로 판정한다.
   */
  paid?: PaidContext;
}

/** 테이블 1개의 진단 결과 산출 */
export function computeDiagnosis(
  allRecords: D3Record[],
  {
    today,
    since,
    until,
    staleLimit = 500,
    paid = { ids: null, since: null },
  }: ComputeOptions
): DiagnosisTable {
  const records = allRecords.filter((r) => {
    const d = kstOf(r.fields['유입시간']);
    if (d === null) return false;
    const day = formatDate(d);
    return day >= since && (until === undefined || day <= until);
  });

  const 시간대별 = SEGMENT_ORDER.map((seg) => {
    const sub = records.filter((r) => {
      const d = kstOf(r.fields['유입시간']);
      return d !== null && timeSegmentOf(d) === seg;
    });
    return segmentRowOf(seg, sub, today, paid);
  }).filter((row) => row.유입 > 0);

  const bySource = (keyFn: (r: D3Record) => string) =>
    [...groupBy(records, keyFn).entries()]
      .map(([k, v]) => segmentRowOf(k, v, today, paid))
      .sort((a, b) => b.유입 - a.유입);

  const 매체별 = bySource(utmSourceOf);
  const 유입페이지별 = bySource(entryPathOf);
  const 교차별 = bySource(crossKeyOf);

  const 담당자별 = [
    ...groupBy(records, (r) => r.fields['[콜]담당자']?.trim() || '(미배정)').entries(),
  ]
    .map(([k, v]) => segmentRowOf(k, v, today, paid))
    .sort((a, b) => b.유입 - a.유입);

  // 방치 버킷 집계 (제외 대상 뺀 미확정만)
  const bucketCount = new Map<string, number>();
  let 제외건수 = 0;
  for (const r of records) {
    if (!isUnresolved(r)) continue;
    if (isExcludedFromStale(r)) {
      제외건수++;
      continue;
    }
    const inflow = kstOf(r.fields['유입시간']);
    if (!inflow) continue;
    const b = staleBucketOf(daysBetween(inflow, today));
    bucketCount.set(b, (bucketCount.get(b) ?? 0) + 1);
  }

  const fail = computeFailReasons(records, paid);

  return {
    전체: conversionOf(records, paid),
    방치버킷: STALE_BUCKET_ORDER.map((b) => ({
      버킷: b,
      건수: bucketCount.get(b) ?? 0,
      조치대상: isActionableBucket(b),
    })).filter((x) => x.건수 > 0),
    방치리드: computeStaleLeads(records, today, staleLimit),
    시간대별,
    매체별,
    유입페이지별,
    교차별,
    담당자별,
    리드타임: computeLeadTime(records),
    실패사유: fail.rows,
    실패사유_기재: {
      기재: fail.기재,
      실패총건: fail.실패총건,
      기재율_pct: pct(fail.기재, fail.실패총건),
    },
    방치_제외건수: 제외건수,
    /*
     * 재컨택은 allRecords 로 계산한다. records 는 유입일로 걸러진 집합이라
     * "과거에 유입돼 그날 접촉된 건"이 빠져 있어 재컨택을 셀 수 없다.
     * 하루 단위 조회(since === until)에서만 값이 나온다.
     */
    재컨택: 재컨택Of(allRecords, {
      day: until !== undefined && since === until ? since : null,
      since,
      until: until ?? since,
    }),
  };
}

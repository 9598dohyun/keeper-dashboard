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
  상담차수Stat,
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
 * 결제건을 첫상담 / 재상담으로 가른다.
 *
 * 기준 (2026-09-03 변경): **유입일이 결제일과 같으면** 첫상담, 그 밖은 재상담.
 *
 * 종전 기준은 `첫응대시각`까지 결제일과 같아야 첫상담으로 봤다. 그런데 이 필드는
 * 상담 시점에 찍히는 게 아니라 **결제를 처리하면서 소급 입력**되는 경우가 많다 —
 * 결제건 167건 중 27건이 결제시각과 5분 이내이고, 메모에 "실통화 8월24일"이라 적힌 건의
 * 첫응대시각이 9/2(결제일)로 찍힌 사례도 있다. 즉 이 필드로는 실제 첫 통화일을 알 수 없다.
 * 게다가 LEADTIME_START(8/11) 이전 유입분은 값이 아예 없어 무조건 재상담으로 떨어졌다
 * (결제 167건 중 30건). 두 문제 모두 이 필드를 판정에서 빼면 사라진다.
 *
 * 한계: 상담 횟수를 센 것이 아니라 **유입에서 결제까지 날이 넘어갔는지**를 본다.
 * 에어테이블에 상담 횟수 필드가 없고, 접촉이력은 리드당 마지막 접촉일 1개만 남는
 * 덮어쓰기 구조라 횟수를 소급 계산할 수 없다. 같은 날 여러 번 상담해 결제된 건도
 * 첫상담으로 잡힌다 — 이 지표는 "당일에 끝났는지"까지만 답한다.
 */
function 상담차수Of단건(r: D3Record, ctx: PaidContext): '첫상담' | '재상담' | null {
  const 결제일 = ctx.payDates?.get(r.id);
  if (!결제일) return null;
  const 유입 = kstOf(r.fields['유입시간']);
  if (!유입) return null; // 유입일을 모르면 판정 불가 — 재상담으로 단정하지 않는다
  return formatDate(유입) === 결제일 ? '첫상담' : '재상담';
}

/** 결제건을 첫상담/재상담으로 분해. 결제일을 모르면(원장 없음) null */
function 상담차수Of(records: D3Record[], paid: PaidContext): 상담차수Stat | null {
  if (!paid.payDates || paid.payDates.size === 0) return null;
  let 첫상담 = 0;
  let 재상담 = 0;
  let 분해불가 = 0;
  // 재상담 건의 유입→결제 소요일. "며칠 걸려 돌아왔나"를 함께 보여준다
  const 소요일: number[] = [];
  for (const r of records) {
    if (!paidOf(r, paid)) continue;
    const v = 상담차수Of단건(r, paid);
    if (v === '첫상담') 첫상담++;
    else if (v === '재상담') {
      재상담++;
      const 유입 = kstOf(r.fields['유입시간']);
      const 결제일 = paid.payDates.get(r.id);
      if (유입 && 결제일) {
        const [y, m, d] = 결제일.split('-').map(Number);
        소요일.push(daysBetween(유입, new Date(y, m - 1, d)));
      }
    } else 분해불가++;
  }
  소요일.sort((a, b) => a - b);
  const mid = 소요일.length >> 1;
  const 중앙 = 소요일.length
    ? 소요일.length % 2
      ? 소요일[mid]
      : Math.round((소요일[mid - 1] + 소요일[mid]) / 2)
    : null;
  const 결제 = 첫상담 + 재상담;
  return {
    첫상담,
    재상담,
    결제,
    첫상담_pct: pct(첫상담, 결제),
    재상담_pct: pct(재상담, 결제),
    재상담_소요일_중앙: 중앙,
    재상담_소요일_최대: 소요일.length ? 소요일[소요일.length - 1] : null,
    분해불가,
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
    상담차수: 상담차수Of(records, paid),
  };
}

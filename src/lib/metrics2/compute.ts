/**
 * SKB+인바운드 지표 계산 (필드 기반, 단일 테이블)
 *
 * 응대·전환: 메모수정시각이 '오늘'(KST)인 리드 기준
 *   Last Modified는 필드 아무거나 수정해도 갱신돼 일괄수정이 응대로 잡혔다(8/21 2503건 등).
 *   메모 필드만 감시하는 메모수정시각으로 교체. 적용일 이전은 값이 없어 Last Modified로 폴백한다.
 * 유입 건수·채널: 유입시간이 '집계시작' 이후인 리드 기준
 */
import { parseUTC, toKST, formatDate } from '../metrics/biz-date';
import { TOP_CHANNELS_COUNT } from '../constants';
import { isPaid, isDuplicate, isB2B, isActive } from './status';
import { normalizeChannel2 } from './channel';
import {
  V2Record,
  PaymentReconcile,
  ConversionMetrics,
  AssigneeMetric,
  InboundMetrics,
  SkbMetrics,
  CountMetrics,
  DailyCount,
} from './types';

/**
 * 메모수정시각 에어테이블 자동화 적용일 = 지표 기준 전환일.
 *
 * 이 날 이전 응대 수치는 Last Modified 기준이라 신뢰할 수 없다.
 * 8/21 인바운드는 14:53 한 분에 1696건이 일괄수정돼 응대 2482건으로 잡혔고(유입 106건),
 * SKB는 스파이크 없이 상시 2~5배 부풀려져 있었다(8/22 유입 2건에 수정 51건).
 * 그래서 이 날 이전 구간은 추이에서 제외한다 — 폴백해서 보여주면 잘못된 값을 계속 노출하게 된다.
 */
export const MEMO_TS_START = '2026-08-26';

/** UTC 문자열 → KST 날짜(YYYY-MM-DD). 없으면 null */
function kstDate(s: string | undefined): string | null {
  const dt = parseUTC(s);
  if (!dt) return null;
  return formatDate(toKST(dt));
}

/** 응대일 = 메모 필드가 수정된 날. 메모를 남긴 것을 응대로 본다 */
function 응대일(r: V2Record): string | null {
  return kstDate(r.fields.메모수정시각);
}

/**
 * 결제 판정.
 *
 * 결제 데이터 엑셀(오전 수신)이 진짜 소스다. 대조 결과가 있으면 그 목록에 있는지로만 본다 —
 * 에어테이블 [콜]최종 결과가 '결제 완료'여도 엑셀에 없으면 결제로 세지 않는다.
 * 대조 결과가 없으면(엑셀 미반영) 기존대로 최종 결과 필드를 쓴다.
 */
function 결제판정(r: V2Record, 결제ID: Set<string> | null): boolean {
  if (결제ID) return 결제ID.has(r.id);
  return isPaid(r.fields['[콜]최종 결과']);
}

/** 오늘 응대건(= 응대일이 today)의 전환 지표 */
function computeConversion(
  records: V2Record[],
  today: string,
  결제ID: Set<string> | null
): ConversionMetrics {
  const 응대건 = records.filter((r) => 응대일(r) === today);
  const 분해 = { 결제: 0, 실패: 0, 중복문의: 0, B2B: 0, 미확정: 0 };
  for (const r of 응대건) {
    const f = r.fields['[콜]최종 결과'];
    if (결제판정(r, 결제ID)) 분해.결제++;
    else if (isDuplicate(f)) 분해.중복문의++;
    else if (isB2B(f)) 분해.B2B++;
    else if (isActive(f)) 분해.미확정++;
    else 분해.실패++; // 실패 + 부재중 실패
  }
  const 응대 = 응대건.length;
  const 결제 = 분해.결제;
  return {
    응대,
    결제,
    전환율_pct: 응대 > 0 ? Math.round((결제 / 응대) * 1000) / 10 : 0,
    분해,
  };
}

/** 오늘 응대건의 담당자별 응대·결제·전환율 (응대 많은 순) */
function computeAssignees(
  records: V2Record[],
  today: string,
  결제ID: Set<string> | null
): AssigneeMetric[] {
  const 응대건 = records.filter((r) => 응대일(r) === today);
  const map = new Map<string, { 응대: number; 결제: number }>();
  for (const r of 응대건) {
    const dam = r.fields['[콜]담당자']?.trim() || '(미배정)';
    const cur = map.get(dam) ?? { 응대: 0, 결제: 0 };
    cur.응대++;
    if (결제판정(r, 결제ID)) cur.결제++;
    map.set(dam, cur);
  }
  return [...map.entries()]
    .map(([담당자, v]) => ({
      담당자,
      응대: v.응대,
      결제: v.결제,
      전환율_pct: v.응대 > 0 ? Math.round((v.결제 / v.응대) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.응대 - a.응대);
}

/**
 * 날짜별 유입 집계 (유입시간 기준, 오름차순)
 *
 * 스냅샷 누적값의 차분이 아니라 원본 레코드에서 직접 센다.
 * 차분 방식은 첫날 값을 못 구하고 스냅샷이 빠진 날 왜곡되므로, 유입은 실집계가 정확하다.
 */
function dailyInflow(records: V2Record[], 집계시작: string): DailyCount[] {
  // 추이는 기준 전환일부터만 그린다 (그 이전은 응대가 다른 기준이라 나란히 두면 오독됨)
  const from = 집계시작 > MEMO_TS_START ? 집계시작 : MEMO_TS_START;
  const map = new Map<string, number>();
  for (const r of records) {
    const d = kstDate(r.fields.유입시간);
    if (d === null || d < from) continue;
    map.set(d, (map.get(d) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([날짜, 건수]) => ({ 날짜, 건수 }));
}

/** 집계시작 이후 유입 리드 */
function inflowSince(records: V2Record[], 집계시작: string): V2Record[] {
  return records.filter((r) => {
    const d = kstDate(r.fields.유입시간);
    return d !== null && d >= 집계시작;
  });
}

export function computeInbound(
  records: V2Record[],
  집계시작: string,
  today: string,
  결제ID: Set<string> | null = null
): InboundMetrics {
  const 유입 = inflowSince(records, 집계시작);
  // 채널 (집계시작 이후 유입 기준)
  const counts = new Map<string, number>();
  for (const r of 유입) {
    const ch = normalizeChannel2(r.fields);
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  const 채널_Top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_CHANNELS_COUNT);
  return {
    전환: computeConversion(records, today, 결제ID),
    담당자별: computeAssignees(records, today, 결제ID),
    유입건수: 유입.length,
    채널_Top,
    유입_일자별: dailyInflow(records, 집계시작),
  };
}

export function computeSkb(
  records: V2Record[],
  집계시작: string,
  today: string,
  결제ID: Set<string> | null = null
): SkbMetrics {
  return {
    전환: computeConversion(records, today, 결제ID),
    담당자별: computeAssignees(records, today, 결제ID),
    유입건수: inflowSince(records, 집계시작).length,
    유입_일자별: dailyInflow(records, 집계시작),
  };
}

export function computeCount(records: V2Record[], 집계시작: string): CountMetrics {
  return {
    건수_전체: records.length,
    건수_오늘이후: inflowSince(records, 집계시작).length,
  };
}

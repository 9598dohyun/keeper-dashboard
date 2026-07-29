/**
 * SKB+인바운드 지표 계산 (필드 기반, 단일 테이블)
 *
 * 응대·전환: Last Modified가 '오늘'(KST)인 리드 기준
 * 유입 건수·채널: 유입시간이 '집계시작' 이후인 리드 기준
 */
import { parseUTC, toKST, formatDate } from '../metrics/biz-date';
import { TOP_CHANNELS_COUNT } from '../constants';
import { isPaid, isDuplicate, isB2B, isActive } from './status';
import { normalizeChannel2 } from './channel';
import {
  V2Record,
  ConversionMetrics,
  AssigneeMetric,
  InboundMetrics,
  SkbMetrics,
  CountMetrics,
} from './types';

/** UTC 문자열 → KST 날짜(YYYY-MM-DD). 없으면 null */
function kstDate(s: string | undefined): string | null {
  const dt = parseUTC(s);
  if (!dt) return null;
  return formatDate(toKST(dt));
}

/** 오늘 응대건(= Last Modified가 today)의 전환 지표 */
function computeConversion(records: V2Record[], today: string): ConversionMetrics {
  const 응대건 = records.filter((r) => kstDate(r.fields['Last Modified']) === today);
  const 분해 = { 결제: 0, 실패: 0, 중복문의: 0, B2B: 0, 미확정: 0 };
  for (const r of 응대건) {
    const f = r.fields['[콜]최종 결과'];
    if (isPaid(f)) 분해.결제++;
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
function computeAssignees(records: V2Record[], today: string): AssigneeMetric[] {
  const 응대건 = records.filter((r) => kstDate(r.fields['Last Modified']) === today);
  const map = new Map<string, { 응대: number; 결제: number }>();
  for (const r of 응대건) {
    const dam = r.fields['[콜]담당자']?.trim() || '(미배정)';
    const cur = map.get(dam) ?? { 응대: 0, 결제: 0 };
    cur.응대++;
    if (isPaid(r.fields['[콜]최종 결과'])) cur.결제++;
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
  today: string
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
    전환: computeConversion(records, today),
    담당자별: computeAssignees(records, today),
    유입건수: 유입.length,
    채널_Top,
  };
}

export function computeSkb(
  records: V2Record[],
  집계시작: string,
  today: string
): SkbMetrics {
  return {
    전환: computeConversion(records, today),
    담당자별: computeAssignees(records, today),
    유입건수: inflowSince(records, 집계시작).length,
  };
}

export function computeCount(records: V2Record[], 집계시작: string): CountMetrics {
  return {
    건수_전체: records.length,
    건수_오늘이후: inflowSince(records, 집계시작).length,
  };
}

/**
 * 날짜별 추이 산출
 *
 * v2:daily:{날짜} 스냅샷들을 모아 하루 단위 시계열을 만든다.
 *
 * 주의: 스냅샷의 `유입건수`는 집계시작 이후 **누적**이다.
 * 그대로 그리면 언제나 우상향하는 선이 되어 추이로서 의미가 없으므로,
 * 전날 누적과의 차이로 그날 유입을 역산한다.
 * 응대·결제는 스냅샷 시점에서 이미 그날 값이라 그대로 쓴다.
 */
import { DashboardV2, TrendPoint } from './types';

/** 누적값 차분 — 첫 점이나 역행(데이터 결손)이면 null */
function dailyFromCumulative(today: number, prev: number | undefined): number | null {
  if (prev === undefined) return null;
  const diff = today - prev;
  return diff >= 0 ? diff : null;
}

/**
 * 날짜 오름차순 스냅샷 목록 → 추이 배열
 * 빠진 날짜는 건너뛴다(선을 이어 그리되 점은 찍지 않음).
 */
export function buildTrend(snapshots: DashboardV2[]): TrendPoint[] {
  const sorted = [...snapshots].sort((a, b) => a.오늘.localeCompare(b.오늘));
  const out: TrendPoint[] = [];

  let prevInbound: number | undefined;
  let prevSkb: number | undefined;

  for (const s of sorted) {
    out.push({
      날짜: s.오늘,
      인바운드: {
        응대: s.인바운드.전환.응대,
        결제: s.인바운드.전환.결제,
        전환율_pct: s.인바운드.전환.전환율_pct,
        유입: dailyFromCumulative(s.인바운드.유입건수, prevInbound),
      },
      skb: {
        응대: s.skb.전환.응대,
        결제: s.skb.전환.결제,
        전환율_pct: s.skb.전환.전환율_pct,
        유입: dailyFromCumulative(s.skb.유입건수, prevSkb),
      },
    });
    prevInbound = s.인바운드.유입건수;
    prevSkb = s.skb.유입건수;
  }

  return out;
}

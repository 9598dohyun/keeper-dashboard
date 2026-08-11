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
 *
 * 유입은 최신 스냅샷의 `유입_일자별`(원본 실집계)을 우선 사용한다.
 * 이 값이 있으면 스냅샷이 하루치뿐이어도 날짜별 유입이 그려지고,
 * 빠진 날짜도 왜곡되지 않는다. 구버전 스냅샷(필드 없음)은 누적 차분으로 대체한다.
 *
 * 응대·결제·전환율은 그날 스냅샷에만 있는 값이라 스냅샷이 있는 날짜만 값을 갖는다.
 */
export function buildTrend(snapshots: DashboardV2[]): TrendPoint[] {
  const sorted = [...snapshots].sort((a, b) => a.오늘.localeCompare(b.오늘));
  if (sorted.length === 0) return [];

  const latest = sorted[sorted.length - 1];
  const inflowInbound = new Map(
    (latest.인바운드.유입_일자별 ?? []).map((d) => [d.날짜, d.건수])
  );
  const inflowSkb = new Map((latest.skb.유입_일자별 ?? []).map((d) => [d.날짜, d.건수]));

  // 유입 실집계가 있으면 그 날짜들까지 축에 포함한다(스냅샷이 없는 날도 유입은 보여야 함)
  const allDates = new Set<string>([
    ...sorted.map((s) => s.오늘),
    ...inflowInbound.keys(),
    ...inflowSkb.keys(),
  ]);
  const byDate = new Map(sorted.map((s) => [s.오늘, s]));

  let prevInbound: number | undefined;
  let prevSkb: number | undefined;

  return [...allDates]
    .sort((a, b) => a.localeCompare(b))
    .map((날짜) => {
      const s = byDate.get(날짜);
      const 유입I = inflowInbound.has(날짜)
        ? inflowInbound.get(날짜)!
        : s
          ? dailyFromCumulative(s.인바운드.유입건수, prevInbound)
          : null;
      const 유입S = inflowSkb.has(날짜)
        ? inflowSkb.get(날짜)!
        : s
          ? dailyFromCumulative(s.skb.유입건수, prevSkb)
          : null;
      if (s) {
        prevInbound = s.인바운드.유입건수;
        prevSkb = s.skb.유입건수;
      }
      return {
        날짜,
        인바운드: {
          응대: s?.인바운드.전환.응대 ?? null,
          결제: s?.인바운드.전환.결제 ?? null,
          전환율_pct: s?.인바운드.전환.전환율_pct ?? null,
          유입: 유입I,
        },
        skb: {
          응대: s?.skb.전환.응대 ?? null,
          결제: s?.skb.전환.결제 ?? null,
          전환율_pct: s?.skb.전환.전환율_pct ?? null,
          유입: 유입S,
        },
      };
    });
}

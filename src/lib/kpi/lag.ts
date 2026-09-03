/**
 * 유입 → 결제 소요일 분석.
 *
 * 결제의 대부분이 유입 당일에 나지 않는다는 것을 드러내는 지표다.
 * 방치 리드를 버릴지 재컨택할지 판단하는 근거로 쓴다 — 31일+ 결제가 실제로 나온다면
 * 오래된 리드도 살아난다는 뜻이다.
 *
 * 결제일은 결제 엑셀 원장에만 있어(2026-08-26~) 그 이전 결제는 판정할 수 없다.
 * 판정 못 한 건수는 `제외`로 함께 낸다 — 감추면 분포가 실제보다 촘촘해 보인다.
 */
import { LagBucket, LagRow, LagByChannel, LagResult } from './types';

export const LAG_BUCKETS: LagBucket[] = ['당일', '1-3일', '4-7일', '8-14일', '15-30일', '31일+'];

function bucketOf(days: number): LagBucket {
  if (days <= 0) return '당일';
  if (days <= 3) return '1-3일';
  if (days <= 7) return '4-7일';
  if (days <= 14) return '8-14일';
  if (days <= 30) return '15-30일';
  return '31일+';
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

/** 결제 1건의 소요일 입력 */
export interface LagInput {
  /** 유입일 YYYY-MM-DD */
  유입일: string | null;
  /** 결제일 YYYY-MM-DD */
  결제일: string | null;
  /** 엑셀 주문유입채널 */
  채널: string;
}

function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

/** 채널을 이 수 이상 가진 것만 별도 행으로 낸다 — 1~2건 채널은 중앙값이 무의미하다 */
const MIN_CHANNEL = 5;

export function computeLag(items: LagInput[]): LagResult {
  const lags: number[] = [];
  const byCh = new Map<string, number[]>();
  let 제외 = 0;

  for (const it of items) {
    if (!it.유입일 || !it.결제일) {
      제외++;
      continue;
    }
    const d = diffDays(it.유입일, it.결제일);
    // 결제일이 유입일보다 앞선 건(새벽 유입 등 데이터 특성)은 당일로 본다
    lags.push(d);
    const arr = byCh.get(it.채널) ?? [];
    arr.push(d);
    byCh.set(it.채널, arr);
  }

  const n = lags.length;
  const count = new Map<LagBucket, number>();
  for (const d of lags) count.set(bucketOf(d), (count.get(bucketOf(d)) ?? 0) + 1);

  let 누적 = 0;
  const 분포: LagRow[] = LAG_BUCKETS.map((b) => {
    const 건수 = count.get(b) ?? 0;
    누적 += 건수;
    return { 버킷: b, 건수, 비중_pct: pct(건수, n), 누적_pct: pct(누적, n) };
  });

  /*
   * (채널없음)은 채널 행에서 뺀다. 8/26 이전 주문은 채널을 저장하지 않아 여기 몰리는데
   * (원장 188건 중 136건), 채널 성과로 읽으면 오독이다. 전체 분포에는 그대로 들어간다.
   */
  const 채널별: LagByChannel[] = [...byCh.entries()]
    .filter(([k, v]) => k !== '(채널없음)' && v.length >= MIN_CHANNEL)
    .map(([채널, v]) => {
      const c = new Map<LagBucket, number>();
      for (const d of v) c.set(bucketOf(d), (c.get(bucketOf(d)) ?? 0) + 1);
      return {
        채널,
        결제: v.length,
        버킷: LAG_BUCKETS.map((b) => c.get(b) ?? 0),
        중앙: median(v),
        당일_pct: pct(v.filter((d) => d <= 0).length, v.length),
      };
    })
    .sort((a, b) => b.결제 - a.결제);

  const 당일 = lags.filter((d) => d <= 0).length;
  const 이내7 = lags.filter((d) => d <= 7).length;

  return {
    n,
    중앙: median(lags),
    당일_pct: pct(당일, n),
    누적7일_pct: pct(이내7, n),
    분포,
    채널별,
    제외,
  };
}

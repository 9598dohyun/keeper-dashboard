'use client';

import type { LeadTimeStat } from '@/lib/metrics3/types';

interface Props {
  data: LeadTimeStat[];
  집계시작: string;
}

/**
 * 리드타임 분포 (유입 → 첫 응대).
 *
 * 신규 유입분과 적체 소화분을 반드시 분리해 표시한다.
 * 자동화 적용 직후에는 과거 유입 건을 뒤늦게 응대한 기록이 섞여
 * 합산하면 실제 응대 속도가 왜곡된다.
 */
export default function LeadTimeChart({ data, 집계시작 }: Props) {
  const 신규합 = data.reduce((s, d) => s + d.신규유입분, 0);
  const 적체합 = data.reduce((s, d) => s + d.적체소화분, 0);

  if (신규합 + 적체합 === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        <p>집계 중 ({집계시작}~)</p>
        <p className="text-xs text-muted-foreground mt-1">
          첫 응대 시각 자동화 적용 이후 데이터가 쌓이면 표시됩니다.
        </p>
      </div>
    );
  }

  const max = Math.max(...data.map((d) => Math.max(d.신규유입분, d.적체소화분)), 1);

  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />
          신규 유입분 {신규합.toLocaleString()}건
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />
          적체 소화분 {적체합.toLocaleString()}건
        </span>
      </div>

      <div className="space-y-2">
        {data.map((d) => (
          <div key={d.버킷} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-xs text-muted-foreground">{d.버킷}</span>
            <div className="flex-1 space-y-0.5">
              <div className="h-3 bg-muted rounded-sm overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-sm"
                  style={{ width: `${(d.신규유입분 / max) * 100}%` }}
                />
              </div>
              <div className="h-3 bg-muted rounded-sm overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-sm"
                  style={{ width: `${(d.적체소화분 / max) * 100}%` }}
                />
              </div>
            </div>
            <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {d.신규유입분} / {d.적체소화분}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        적체 소화분 = 유입 다음 날 이후에 첫 응대한 건. 응대 속도 판단은 신규 유입분으로 할 것.
      </p>
    </div>
  );
}

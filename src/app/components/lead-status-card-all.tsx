'use client';

import MetricCard from './metric-card';
import { AllTimeBreakdown } from '@/lib/types';

export default function LeadStatusCardAll({ data }: { data: AllTimeBreakdown }) {
  const total = data.합계 || 1;
  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 mb-3">리드 풀 (전체 기간)</h2>
      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          title="신규 리드"
          value={data.신규.toLocaleString()}
          unit="건"
          sub={`메모 없음 · 미컨택 (${pct(data.신규)})`}
          color="blue"
        />
        <MetricCard
          title="잔존 리드"
          value={data.잔존.toLocaleString()}
          unit="건"
          sub={`메모 있음 · 미결 (${pct(data.잔존)})`}
          color="blue"
        />
        <MetricCard
          title="처리완료"
          value={data.처리완료.toLocaleString()}
          unit="건"
          sub={`최종결과 입력 (${pct(data.처리완료)})`}
          color="blue"
        />
      </div>
    </div>
  );
}

'use client';

import MetricCard from './metric-card';
import { ActionMetrics } from '@/lib/types';

export default function ActionStatusCard({ data }: { data: ActionMetrics }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-green-600 mb-3">액션 현황</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          title="컨택"
          value={data.오늘컨택}
          sub={`신규 ${data.오늘컨택_신규} / 기존 ${data.오늘컨택_기존팔로업}`}
          color="green"
        />
        <MetricCard
          title="성공"
          value={data.오늘성공}
          sub={`신규 ${data.오늘성공_신규} / 기존 ${data.오늘성공_기존}`}
          color="green"
        />
        <MetricCard
          title="실패"
          value={data.오늘실패}
          sub={data.오늘실패_중복 > 0 ? `(중복 ${data.오늘실패_중복})` : undefined}
          color="yellow"
        />
        <MetricCard
          title="부재중"
          value={data.오늘부재}
          color="red"
        />
      </div>
    </div>
  );
}

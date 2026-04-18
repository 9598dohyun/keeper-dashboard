'use client';

import MetricCard from './metric-card';
import { LeadMetrics } from '@/lib/types';

export default function LeadStatusCard({ data }: { data: LeadMetrics }) {
  const delta = data.오늘잔존 - data.전날잔존;
  const sign = delta >= 0 ? '+' : '';

  return (
    <div>
      <h2 className="text-sm font-semibold text-blue-600 mb-3">리드 현황</h2>
      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          title="전날 잔존"
          value={data.전날잔존.toLocaleString()}
          color="blue"
        />
        <MetricCard
          title="오늘 신규"
          value={data.오늘신규_고유.toLocaleString()}
          sub={data.오늘신규_중복 > 0 ? `(중복 ${data.오늘신규_중복})` : undefined}
          color="blue"
        />
        <MetricCard
          title="오늘 잔존"
          value={data.오늘잔존.toLocaleString()}
          sub={`${sign}${delta}건`}
          color="blue"
        />
      </div>
    </div>
  );
}

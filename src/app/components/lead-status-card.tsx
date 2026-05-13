'use client';

import MetricCard from './metric-card';
import { LeadMetrics } from '@/lib/types';

export default function LeadStatusCard({ data }: { data: LeadMetrics }) {
  const delta = data.오늘잔존 - data.전날잔존;
  const sign = delta >= 0 ? '+' : '';

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 mb-3">리드 풀</h2>
      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          title="남은 리드"
          value={data.전날잔존.toLocaleString()}
          unit="건"
          sub="이전 미처리"
          color="blue"
        />
        <MetricCard
          title="받은 리드"
          value={data.오늘신규_고유.toLocaleString()}
          unit="건"
          sub={data.오늘신규_중복 > 0 ? `이번 유입 · 중복 ${data.오늘신규_중복}건 제외` : '이번 유입'}
          color="blue"
        />
        <MetricCard
          title="오늘 마감 잔여"
          value={data.오늘잔존.toLocaleString()}
          unit="건"
          sub={`전 마감 대비 ${sign}${delta}건`}
          color="blue"
        />
      </div>
    </div>
  );
}

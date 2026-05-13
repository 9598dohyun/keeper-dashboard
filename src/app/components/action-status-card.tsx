'use client';

import MetricCard from './metric-card';
import { ActionMetrics } from '@/lib/types';

export default function ActionStatusCard({ data }: { data: ActionMetrics }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-green-600 mb-3">오늘 한 일</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          title="응대한 리드"
          value={data.오늘컨택}
          unit="건"
          sub={`신규 ${data.오늘컨택_신규}건 · 잔존 ${data.오늘컨택_기존팔로업}건`}
          color="green"
        />
        <MetricCard
          title="결제한 리드"
          value={data.오늘성공}
          unit="건"
          sub={`신규 ${data.오늘성공_신규}건 · 잔존 ${data.오늘성공_기존}건`}
          color="green"
        />
        <MetricCard
          title="놓친 리드"
          value={data.오늘실패}
          unit="건"
          sub={data.오늘실패_중복 > 0 ? `중복 문의 ${data.오늘실패_중복}건 포함` : '실패 처리'}
          color="yellow"
        />
        <MetricCard
          title="부재"
          value={data.오늘부재}
          unit="건"
          sub="연결되지 않음"
          color="red"
        />
      </div>
    </div>
  );
}

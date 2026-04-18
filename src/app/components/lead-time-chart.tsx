'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { LeadTimeMetrics } from '@/lib/types';

const BUCKETS = ['≤5분', '5~30분', '30~60분', '1~3시간', '3~12시간', '12시간+'] as const;

export default function LeadTimeChart({ data, newCount }: { data: LeadTimeMetrics; newCount: number }) {
  if (data.샘플_건 === 0) {
    return (
      <div>
        <h2 className="text-sm font-semibold text-red-600 mb-3">리드타임</h2>
        <div className="bg-white rounded-xl border p-4 text-center text-gray-400">
          샘플 0건
        </div>
      </div>
    );
  }

  const chartData = BUCKETS.map(b => ({
    name: b,
    건수: data[b] || 0,
  }));

  const missed = newCount - data.샘플_건;

  return (
    <div>
      <h2 className="text-sm font-semibold text-red-600 mb-3">리드타임</h2>
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-baseline gap-4 mb-3">
          <div>
            <span className="text-xs text-gray-500">중앙값</span>
            <span className="text-xl font-bold ml-2">{data.중앙값_분}분</span>
          </div>
          <div className="text-xs text-gray-400">
            평균 {data.평균_분}분 / 샘플 {data.샘플_건}건
            {missed > 0 && ` / 미컨택 ${missed}건`}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={30} />
            <Tooltip />
            <Bar dataKey="건수" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendEntry } from '@/lib/types';

export default function TrendChart({ data }: { data: TrendEntry[] }) {
  if (!data || data.length === 0) return null;

  const chartData = data.map(d => ({
    ...d,
    날짜: d.date.slice(5), // MM-DD
  }));

  return (
    <div>
      <h2 className="text-sm font-semibold text-orange-600 mb-3">일별 추이 (14일)</h2>
      <div className="bg-white rounded-xl border p-4 space-y-4">
        <div>
          <div className="text-xs text-gray-500 mb-1">전환율 / 소진율 / 부재율 (%)</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <XAxis dataKey="날짜" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={35} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="전환율" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="소진율" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="부재율" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">성공 / 실패 (건)</div>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={chartData}>
              <XAxis dataKey="날짜" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={35} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="오늘성공" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="오늘실패" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="오늘신규_고유" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function ChannelChart({ data }: { data: [string, number][] }) {
  if (!data || data.length === 0) return null;

  const chartData = data.map(([name, count]) => ({ name, 건수: count }));

  return (
    <div>
      <h2 className="text-sm font-semibold text-purple-600 mb-3">채널별 신규 분포</h2>
      <div className="bg-white rounded-xl border p-4">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} layout="vertical">
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
            <Tooltip />
            <Bar dataKey="건수" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

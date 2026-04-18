'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Props {
  유입: Record<number, number>;
  성공: Record<number, number>;
  실패: Record<number, number>;
}

export default function HourlyChart({ 유입, 성공, 실패 }: Props) {
  // 0~23시 데이터 생성
  const data = Array.from({ length: 24 }, (_, h) => ({
    시간: `${h}시`,
    유입: 유입[h] || 0,
    성공: 성공[h] || 0,
    실패: 실패[h] || 0,
  }));

  return (
    <div>
      <h2 className="text-sm font-semibold text-indigo-600 mb-3">시간대별 분포</h2>
      <div className="bg-white rounded-xl border p-4">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <XAxis dataKey="시간" tick={{ fontSize: 9 }} interval={2} />
            <YAxis tick={{ fontSize: 11 }} width={30} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="유입" fill="#6366f1" radius={[2, 2, 0, 0]} />
            <Bar dataKey="성공" fill="#22c55e" radius={[2, 2, 0, 0]} />
            <Bar dataKey="실패" fill="#ef4444" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

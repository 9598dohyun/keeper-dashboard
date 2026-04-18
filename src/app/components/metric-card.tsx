'use client';

interface MetricCardProps {
  title: string;
  value: string | number;
  sub?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
}

const colorMap = {
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  green: 'bg-green-50 border-green-200 text-green-700',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  red: 'bg-red-50 border-red-200 text-red-700',
  gray: 'bg-gray-50 border-gray-200 text-gray-700',
};

export default function MetricCard({ title, value, sub, color = 'gray' }: MetricCardProps) {
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <div className="text-xs font-medium opacity-70">{title}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs mt-1 opacity-60">{sub}</div>}
    </div>
  );
}

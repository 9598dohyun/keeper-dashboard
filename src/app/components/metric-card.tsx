'use client';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;      // "건", "%" 등 값 옆에 작게 표기
  sub?: string;       // 보조 설명 (예: "결제 26 / 전체 678")
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
}

const colorMap = {
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  green: 'bg-green-50 border-green-200 text-green-700',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  red: 'bg-red-50 border-red-200 text-red-700',
  gray: 'bg-muted/50 border-border text-foreground',
};

export default function MetricCard({ title, value, unit, sub, color = 'gray' }: MetricCardProps) {
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <div className="text-xs font-semibold opacity-80">{title}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-bold">{value}</span>
        {unit && <span className="text-sm font-semibold opacity-70">{unit}</span>}
      </div>
      {sub && <div className="text-xs mt-1 font-medium opacity-80">{sub}</div>}
    </div>
  );
}

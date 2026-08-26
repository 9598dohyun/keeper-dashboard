'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

const config = {
  건수: { label: '건수', color: 'var(--color-chart-1)' },
} satisfies ChartConfig;

export default function ChannelChart({ data }: { data: [string, number][] }) {
  if (!data || data.length === 0) return null;

  const chartData = data.map(([name, count]) => ({ name, 건수: count }));

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">채널별 신규 분포</h3>
      <ChartContainer config={config} className="aspect-[5/2] w-full">
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 12 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis
            dataKey="name"
            type="category"
            tickLine={false}
            axisLine={false}
            width={120}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="건수" fill="var(--color-건수)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

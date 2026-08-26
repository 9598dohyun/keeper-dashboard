'use client';

import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { TrendPoint } from '@/lib/metrics2/types';

type TableKey = '인바운드' | 'skb';

interface Props {
  data: TrendPoint[];
  table: TableKey;
}

/**
 * 날짜별 추이 (누적 아님).
 *
 * 지표마다 단위가 달라(건수 vs %) 한 축에 겹치지 않는다.
 * 이중 축 대신 지표별로 차트를 나눠 그린다.
 */
type MetricKey = '유입' | '응대' | '결제' | '전환율_pct';

const METRICS: { key: MetricKey; label: string; unit: string; color: string }[] = [
  { key: '유입', label: '유입', unit: '건', color: 'var(--color-chart-1)' },
  { key: '응대', label: '응대', unit: '건', color: 'var(--color-chart-2)' },
  { key: '결제', label: '결제', unit: '건', color: 'var(--color-chart-3)' },
  { key: '전환율_pct', label: '전환율', unit: '%', color: 'var(--color-chart-1)' },
];

function MetricChart({
  metric,
  rows,
}: {
  metric: (typeof METRICS)[number];
  rows: { 날짜: string; value: number | null }[];
}) {
  const config = {
    value: { label: metric.label, color: metric.color },
  } satisfies ChartConfig;

  const last = [...rows].reverse().find((r) => r.value !== null);

  return (
    <figure className="m-0">
      <figcaption className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-semibold text-foreground">{metric.label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          최근 {last?.value ?? '—'}
          {metric.unit}
        </span>
      </figcaption>
      <ChartContainer config={config} className="aspect-[4/1] w-full">
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="날짜"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis tickLine={false} axisLine={false} width={44} allowDecimals={false} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => `${value}${metric.unit}`}
                labelFormatter={(label) => String(label)}
              />
            }
          />
          {/* connectNulls=false — 없는 데이터를 이어 그리면 거짓 추세가 된다 */}
          <Line
            dataKey="value"
            type="monotone"
            stroke="var(--color-value)"
            strokeWidth={2}
            dot={{ r: 2.5 }}
            activeDot={{ r: 4 }}
            connectNulls={false}
          />
        </LineChart>
      </ChartContainer>
    </figure>
  );
}

export default function TrendLines({ data, table }: Props) {
  const [showTable, setShowTable] = useState(false);

  const series = useMemo(
    () =>
      METRICS.map((m) => ({
        metric: m,
        rows: data.map((d) => ({ 날짜: d.날짜, value: d[table][m.key] as number | null })),
      })),
    [data, table]
  );

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        추이를 그리려면 날짜별 스냅샷이 2일 이상 필요합니다.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
        {series.map((s) => (
          <MetricChart key={s.metric.key} metric={s.metric} rows={s.rows} />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => setShowTable((v) => !v)}>
          {showTable ? '표 닫기' : '표로 보기'}
        </Button>
        <span className="text-xs text-muted-foreground">
          날짜별 값(누적 아님) · 유입은 전날 누적과의 차이로 산출
        </span>
      </div>

      {showTable && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>날짜</TableHead>
                {METRICS.map((m) => (
                  <TableHead key={m.key} className="text-right">
                    {m.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...data].reverse().map((d) => (
                <TableRow key={d.날짜}>
                  <TableCell className="tabular-nums">{d.날짜}</TableCell>
                  {METRICS.map((m) => (
                    <TableCell key={m.key} className="text-right tabular-nums">
                      {d[table][m.key] ?? '—'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

'use client';

import { KPIMetrics } from '@/lib/types';

function Gauge({ label, value, formula }: { label: string; value: number; formula: string }) {
  const color = label === '전환율'
    ? 'text-emerald-600'
    : label === '소진율'
    ? 'text-blue-600'
    : 'text-red-500';

  return (
    <div className="bg-white rounded-xl border p-4 text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${color}`}>{value}%</div>
      <div className="text-xs text-gray-400 mt-1">{formula}</div>
    </div>
  );
}

export default function KPIGauges({ data }: { data: KPIMetrics }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-yellow-600 mb-3">KPI</h2>
      <div className="grid grid-cols-3 gap-3">
        <Gauge
          label="전환율"
          value={data.전환율_pct}
          formula={`${data.전환율_분자} / ${data.전환율_분모}`}
        />
        <Gauge
          label="소진율"
          value={data.소진율_pct}
          formula={`${data.소진율_분자} / ${data.소진율_분모}`}
        />
        <Gauge
          label="부재율"
          value={data.부재율_pct}
          formula={`${data.부재율_분자} / ${data.부재율_분모}`}
        />
      </div>
    </div>
  );
}

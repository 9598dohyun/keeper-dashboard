'use client';

import { KPIMetrics } from '@/lib/types';

function Gauge({
  label,
  value,
  numerator,
  denominator,
  numLabel,
  denomLabel,
}: {
  label: string;
  value: number;
  numerator: number;
  denominator: number;
  numLabel: string;
  denomLabel: string;
}) {
  const color = label === '결제율'
    ? 'text-emerald-600'
    : label === '응대율'
    ? 'text-blue-600'
    : 'text-red-500';

  return (
    <div className="bg-white rounded-xl border p-4 text-center">
      <div className="text-sm font-semibold text-gray-700">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${color}`}>{value}%</div>
      <div className="text-xs text-gray-600 font-medium mt-2">
        {numLabel} <span className="font-semibold">{numerator}</span>
        <span className="text-gray-400 mx-1">/</span>
        {denomLabel} <span className="font-semibold">{denominator}</span>
      </div>
    </div>
  );
}

export default function KPIGauges({ data }: { data: KPIMetrics }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-yellow-600 mb-3">KPI</h2>
      <div className="grid grid-cols-3 gap-3">
        <Gauge
          label="결제율"
          value={data.전환율_pct}
          numerator={data.전환율_분자}
          denominator={data.전환율_분모}
          numLabel="결제"
          denomLabel="전체"
        />
        <Gauge
          label="응대율"
          value={data.소진율_pct}
          numerator={data.소진율_분자}
          denominator={data.소진율_분모}
          numLabel="응대"
          denomLabel="받은"
        />
        <Gauge
          label="부재율"
          value={data.부재율_pct}
          numerator={data.부재율_분자}
          denominator={data.부재율_분모}
          numLabel="부재"
          denomLabel="응대"
        />
      </div>
    </div>
  );
}

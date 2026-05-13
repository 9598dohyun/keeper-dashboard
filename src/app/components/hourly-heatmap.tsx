'use client';

import { useState, useEffect } from 'react';

type MetricType = '유입' | '성공' | '실패';

interface HeatmapRow {
  day: number;
  hours: number[];
}

interface HeatmapResponse {
  rows: HeatmapRow[];
  days: number;
  metric: MetricType;
  total: number;
  dates?: string[];
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const METRIC_OPTIONS: MetricType[] = ['유입', '성공', '실패'];

// 값에 따라 셀 배경 컬러 강도 (0~1 normalized)
function colorFor(value: number, max: number, metric: MetricType): string {
  if (value === 0 || max === 0) return 'bg-gray-50';
  const intensity = Math.min(value / max, 1);
  const buckets = [0.15, 0.3, 0.5, 0.7, 0.85, 1];
  const idx = buckets.findIndex(b => intensity <= b);
  const scale = idx === -1 ? 5 : idx;
  if (metric === '성공') {
    return ['bg-green-50', 'bg-green-100', 'bg-green-200', 'bg-green-300', 'bg-green-400', 'bg-green-500'][scale];
  }
  if (metric === '실패') {
    return ['bg-red-50', 'bg-red-100', 'bg-red-200', 'bg-red-300', 'bg-red-400', 'bg-red-500'][scale];
  }
  return ['bg-blue-50', 'bg-blue-100', 'bg-blue-200', 'bg-blue-300', 'bg-blue-400', 'bg-blue-500'][scale];
}

export default function HourlyHeatmap() {
  const [metric, setMetric] = useState<MetricType>('유입');
  const [days, setDays] = useState(14);
  const [data, setData] = useState<HeatmapResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/metrics?type=hourly-heatmap&metric=${metric}&days=${days}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // 무시
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [metric, days]);

  if (!data) return null;

  // 최댓값 계산 (색상 정규화)
  let max = 0;
  for (const row of data.rows) {
    for (const v of row.hours) {
      if (v > max) max = v;
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-cyan-600">
          시간대별 히트맵 (최근 {data.dates?.length ?? data.days}일 · 총 {data.total}건)
        </h2>
        <div className="flex gap-2 items-center">
          <div className="flex gap-1">
            {METRIC_OPTIONS.map(m => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-2 py-0.5 text-xs rounded ${
                  metric === m ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {[14, 30, 60, 90].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-2 py-0.5 text-xs rounded ${
                  days === d ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {d}일
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl border p-4 overflow-x-auto">
        {loading && <div className="text-xs text-gray-400 mb-2">불러오는 중…</div>}
        <table className="text-[10px] border-collapse">
          <thead>
            <tr>
              <th className="w-8"></th>
              {Array.from({ length: 24 }, (_, h) => (
                <th key={h} className="w-7 text-center text-gray-500 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6, 0].map(dayIdx => {
              const row = data.rows.find(r => r.day === dayIdx);
              if (!row) return null;
              return (
                <tr key={dayIdx}>
                  <td className="text-gray-600 pr-1 text-right">{DAY_LABELS[dayIdx]}</td>
                  {row.hours.map((v, h) => (
                    <td
                      key={h}
                      className={`w-7 h-7 text-center align-middle ${colorFor(v, max, metric)} ${v > 0 ? (v / max > 0.5 ? 'text-white' : 'text-gray-700') : 'text-gray-300'}`}
                      title={`${DAY_LABELS[dayIdx]} ${h}시: ${v}건`}
                    >
                      {v > 0 ? v : ''}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-2 text-[10px] text-gray-500">월~토 + 일 순서 · 셀 값은 기간 합계 건수</div>
      </div>
    </div>
  );
}

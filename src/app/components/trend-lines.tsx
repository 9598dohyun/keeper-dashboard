'use client';

import { useMemo, useState } from 'react';
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
type Metric = {
  key: '유입' | '응대' | '결제' | '전환율_pct';
  label: string;
  unit: string;
  color: string;
};

const METRICS: Metric[] = [
  { key: '유입', label: '유입', unit: '건', color: 'var(--series-1)' },
  { key: '응대', label: '응대', unit: '건', color: 'var(--series-2)' },
  { key: '결제', label: '결제', unit: '건', color: 'var(--series-3)' },
  { key: '전환율_pct', label: '전환율', unit: '%', color: 'var(--series-1)' },
];

const W = 560;
const H = 140;
const PAD = { top: 12, right: 12, bottom: 22, left: 36 };

function Sparkline({ points, metric }: { points: { x: string; y: number | null }[]; metric: Metric }) {
  const [hover, setHover] = useState<number | null>(null);

  const valid = points.filter((p) => p.y !== null) as { x: string; y: number }[];
  const max = Math.max(...valid.map((p) => p.y), metric.unit === '%' ? 5 : 1);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const xOf = (i: number) =>
    PAD.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const yOf = (v: number) => PAD.top + innerH - (v / max) * innerH;

  // null 구간에서 선을 끊는다 (없는 데이터를 이어 그리면 거짓 추세가 된다)
  const segments: string[] = [];
  let cur: string[] = [];
  points.forEach((p, i) => {
    if (p.y === null) {
      if (cur.length) segments.push(cur.join(' '));
      cur = [];
      return;
    }
    cur.push(`${cur.length ? 'L' : 'M'}${xOf(i).toFixed(1)},${yOf(p.y).toFixed(1)}`);
  });
  if (cur.length) segments.push(cur.join(' '));

  const last = [...points].reverse().find((p) => p.y !== null);
  const ticks = [0, max / 2, max];

  return (
    <figure className="m-0">
      <figcaption className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
          {metric.label}
        </span>
        <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
          최근 {last?.y ?? '—'}
          {metric.unit}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`${metric.label} 날짜별 추이`}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yOf(t)}
              y2={yOf(t)}
              stroke="var(--grid)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={yOf(t) + 3}
              textAnchor="end"
              fontSize={9}
              fill="var(--text-muted)"
            >
              {metric.unit === '%' ? t.toFixed(0) : Math.round(t)}
            </text>
          </g>
        ))}

        {segments.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={metric.color} strokeWidth={2} strokeLinecap="round" />
        ))}

        {points.map((p, i) =>
          p.y === null ? null : (
            <circle
              key={p.x}
              cx={xOf(i)}
              cy={yOf(p.y)}
              r={hover === i ? 4 : 2.5}
              fill={metric.color}
              stroke="var(--surface-1)"
              strokeWidth={2}
            />
          )
        )}

        {/* 히트 영역 — 마크보다 넓게 */}
        {points.map((p, i) => (
          <rect
            key={`hit-${p.x}`}
            x={xOf(i) - innerW / Math.max(points.length, 1) / 2}
            y={PAD.top}
            width={Math.max(innerW / Math.max(points.length, 1), 8)}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}

        {hover !== null && points[hover] && (
          <line
            x1={xOf(hover)}
            x2={xOf(hover)}
            y1={PAD.top}
            y2={PAD.top + innerH}
            stroke="var(--text-muted)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {/* x축 — 처음·중간·마지막만 (라벨 충돌 방지) */}
        {[0, Math.floor(points.length / 2), points.length - 1]
          .filter((i, idx, a) => i >= 0 && a.indexOf(i) === idx && points[i])
          .map((i) => (
            <text
              key={`x-${i}`}
              x={xOf(i)}
              y={H - 6}
              textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
              fontSize={9}
              fill="var(--text-muted)"
            >
              {points[i].x.slice(5)}
            </text>
          ))}
      </svg>
      {hover !== null && points[hover] && (
        <p className="text-xs mt-1 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
          {points[hover].x} · {points[hover].y ?? '—'}
          {points[hover].y !== null && metric.unit}
        </p>
      )}
    </figure>
  );
}

export default function TrendLines({ data, table }: Props) {
  const [showTable, setShowTable] = useState(false);

  const series = useMemo(
    () =>
      METRICS.map((m) => ({
        metric: m,
        points: data.map((d) => ({ x: d.날짜, y: d[table][m.key] as number | null })),
      })),
    [data, table]
  );

  if (data.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        추이를 그리려면 날짜별 스냅샷이 2일 이상 필요합니다.
      </p>
    );
  }

  return (
    <div className="viz-root space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-5">
        {series.map((s) => (
          <Sparkline key={s.metric.key} points={s.points} metric={s.metric} />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowTable((v) => !v)}
          className="text-xs font-semibold border rounded px-3 py-1.5 hover:bg-gray-50"
        >
          {showTable ? '표 닫기' : '표로 보기'}
        </button>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          날짜별 값(누적 아님) · 유입은 전날 누적과의 차이로 산출
        </span>
      </div>

      {showTable && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left border-b" style={{ color: 'var(--text-secondary)' }}>
                <th className="py-1.5 pr-3 font-semibold">날짜</th>
                {METRICS.map((m) => (
                  <th key={m.key} className="py-1.5 px-3 font-semibold text-right">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.날짜} className="border-b border-gray-100">
                  <td className="py-1.5 pr-3 tabular-nums">{d.날짜}</td>
                  {METRICS.map((m) => (
                    <td key={m.key} className="py-1.5 px-3 text-right tabular-nums">
                      {d[table][m.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import type { BurndownPoint } from '@/lib/kpi/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * 목표 대비 누적 추이.
 *
 * 하루 격차(-10건)만으로는 좁혀지는 중인지 벌어지는 중인지 알 수 없다.
 * 두 선을 겹쳐 추세를 본다.
 *
 * 색: 실적 #3b82f6 · 목표 #d97706 — light/dark 양쪽 검증 통과 조합.
 * 2px 선, 계열 2개이므로 범례를 둔다.
 */
export default function BurndownChart() {
  const [data, setData] = useState<BurndownPoint[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/kpi?type=burndown')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setData(Array.isArray(d) ? d : null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!data || !data.length) return null;

  const 실적있는 = data.filter((d) => d.누적실적 !== null);
  // 실적이 이틀뿐이면 선이 거의 안 보인다 — 그 사실을 숨기지 않고 알린다
  const 표본부족 = 실적있는.length < 5;

  const W = 720;
  const H = 200;
  const PAD = { l: 44, r: 12, t: 8, b: 22 };
  const maxY = Math.max(...data.map((d) => Math.max(d.누적목표, d.누적실적 ?? 0)), 1);
  const x = (i: number) => PAD.l + (i / Math.max(data.length - 1, 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / maxY) * (H - PAD.t - PAD.b);

  const line = (pick: (d: BurndownPoint) => number | null) =>
    data
      .map((d, i) => ({ i, v: pick(d) }))
      .filter((p): p is { i: number; v: number } => p.v !== null)
      .map((p, j) => `${j === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`)
      .join(' ');

  const 마지막 = 실적있는[실적있는.length - 1];
  const 눈금 = [0, Math.round(maxY / 2), maxY];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">목표 대비 누적 추이</CardTitle>
        <CardDescription>
          누적 실적이 누적 목표선 위에 있으면 앞서가는 것. 목표선은 영업일에만 올라간다
          (주말·공휴일은 평평).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-[#3b82f6]" />
            누적 실적{' '}
            <strong className="tabular-nums text-foreground">
              {마지막?.누적실적?.toLocaleString() ?? 0}
            </strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-[#d97706]" />
            누적 목표{' '}
            <strong className="tabular-nums text-foreground">
              {마지막?.누적목표.toLocaleString() ?? 0}
            </strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-[200px] w-full min-w-[560px]"
            role="img"
            aria-label="목표 대비 누적 추이"
          >
            {/* 눈금 — 격자는 뒤로 물린다 */}
            {눈금.map((v) => (
              <g key={v}>
                <line
                  x1={PAD.l}
                  x2={W - PAD.r}
                  y1={y(v)}
                  y2={y(v)}
                  className="stroke-border"
                  strokeWidth="1"
                />
                <text
                  x={PAD.l - 6}
                  y={y(v) + 3}
                  textAnchor="end"
                  className="fill-muted-foreground text-[9px] tabular-nums"
                >
                  {v.toLocaleString()}
                </text>
              </g>
            ))}

            {/* 날짜 축 — 5일 간격만 */}
            {data.map((d, i) =>
              Number(d.날짜.slice(8)) % 5 === 0 ? (
                <text
                  key={d.날짜}
                  x={x(i)}
                  y={H - 6}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[9px] tabular-nums"
                >
                  {Number(d.날짜.slice(8))}
                </text>
              ) : null
            )}

            <path d={line((d) => d.누적목표)} fill="none" stroke="#d97706" strokeWidth="2" />
            <path d={line((d) => d.누적실적)} fill="none" stroke="#3b82f6" strokeWidth="2" />

            {/* 마지막 실적점 — 8px 이상 마커, 서피스 링 */}
            {마지막 && (
              <circle
                cx={x(data.findIndex((d) => d.날짜 === 마지막.날짜))}
                cy={y(마지막.누적실적 ?? 0)}
                r="4.5"
                fill="#3b82f6"
                className="stroke-card"
                strokeWidth="2"
              />
            )}
          </svg>
        </div>

        {표본부족 && (
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            실적이 {실적있는.length}일치라 추세를 읽기엔 아직 이르다. 1~2주 쌓이면 격차가
            좁혀지는지 벌어지는지 보인다.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

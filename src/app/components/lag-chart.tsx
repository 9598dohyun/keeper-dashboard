'use client';

import { useEffect, useState } from 'react';
import type { LagResult } from '@/lib/kpi/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * 유입 → 결제 소요일 분포.
 *
 * 결제가 유입 당일에만 나지 않는다는 것을 드러내는 지표다. 방치 리드를 버릴지
 * 재컨택할지 판단하는 근거로 쓴다 — 31일+ 결제가 실제로 나온다면 오래된 리드도 살아난다.
 *
 * 색: #3b82f6 단일 계열이라 범례 없이 제목이 계열을 지시한다.
 * light/dark 양쪽에서 lightness·CVD·contrast 검증 통과한 값이다.
 */
export default function LagChart() {
  const [data, setData] = useState<LagResult | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/kpi?type=lag')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setData(d && !d.error ? d : null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!data || !data.n) return null;

  const max = Math.max(...data.분포.map((r) => r.건수), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">유입 → 결제 소요일</CardTitle>
        <CardDescription>
          결제된 리드가 유입 후 며칠에 결제됐는지 · 결제 {data.n.toLocaleString()}건 기준 · 중앙{' '}
          {data.중앙}일
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs tabular-nums text-muted-foreground">
          <span>
            당일 결제 <strong className="text-foreground">{data.당일_pct}%</strong>
          </span>
          <span>
            7일 내 <strong className="text-foreground">{data.누적7일_pct}%</strong>
          </span>
          <span>
            그 이후{' '}
            <strong className="text-foreground">
              {Math.round((100 - data.누적7일_pct) * 10) / 10}%
            </strong>
          </span>
        </div>

        <div className="space-y-1.5">
          {data.분포.map((r) => (
            <div key={r.버킷} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-xs text-foreground">{r.버킷}</span>
              <div className="relative h-6 flex-1">
                <div
                  className="absolute inset-y-0 left-0 rounded-r bg-[#3b82f6]"
                  style={{ width: `${Math.max((r.건수 / max) * 100, r.건수 > 0 ? 1.5 : 0)}%` }}
                />
              </div>
              <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {r.건수}건 · {r.비중_pct}%
              </span>
              <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                누적 {r.누적_pct}%
              </span>
            </div>
          ))}
        </div>

        {data.채널별.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-2 text-xs font-semibold text-foreground">채널별 소요일</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-1.5 pr-3 font-semibold">채널</th>
                    <th className="px-2 py-1.5 text-right font-semibold">결제</th>
                    <th className="px-2 py-1.5 text-right font-semibold">중앙</th>
                    <th className="py-1.5 pl-2 text-right font-semibold">당일 비중</th>
                  </tr>
                </thead>
                <tbody>
                  {data.채널별.map((c) => (
                    <tr key={c.채널} className="border-b border-border">
                      <td className="py-1.5 pr-3 font-medium">{c.채널}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{c.결제}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{c.중앙}일</td>
                      <td className="py-1.5 pl-2 text-right tabular-nums">{c.당일_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              결제 5건 미만 채널과 채널 기록이 없는 과거 주문은 이 표에서 제외 (위 분포에는 포함)
            </p>
          </div>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          결제일 기록이 있는 건만 센다. 유입일 또는 결제일을 몰라 제외된 건이{' '}
          {data.제외.toLocaleString()}건 있다(리드가 없는 채널, 결제 데이터 축적 이전 주문).
        </p>
      </CardContent>
    </Card>
  );
}

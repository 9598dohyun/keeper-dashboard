'use client';

import { useEffect, useState } from 'react';
import type { ChannelPayResult } from '@/lib/kpi/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * 채널별 결제 (엑셀 원장 기준).
 *
 * 위쪽 채널 차트는 `UTM_source` 기준 **유입** 분포라 축이 다르다. 여기는 엑셀
 * `주문유입채널` 기준 **결제**이고, 에어테이블에 리드가 없는 채널(오가닉·키퍼맨·
 * B2B 영업 등)까지 센다 — 대시보드 결제수에는 안 잡히는 물량이다.
 */
export default function ChannelPayCard() {
  const [data, setData] = useState<ChannelPayResult | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/kpi?type=channel')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setData(d && !d.error ? d : null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!data || !data.행.length) return null;

  const max = Math.max(...data.행.map((r) => r.결제));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">채널별 결제 (이번 달)</CardTitle>
        <CardDescription>
          결제 데이터 엑셀의 주문유입채널 기준 · {data.기간.시작} ~ {data.기간.종료} · 총{' '}
          {data.총결제}건. 위 채널 차트는 유입 분포라 세는 대상이 다르다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.행.map((r) => (
            <div key={r.채널} className="flex items-center gap-2">
              <span className="w-20 shrink-0 truncate text-xs text-foreground" title={r.채널}>
                {r.채널}
              </span>
              <div className="relative h-5 flex-1 overflow-hidden rounded bg-muted">
                {/*
                  리드 있는 건과 없는 건을 한 바에서 색으로 나눈다. 리드 없는 건은
                  대시보드 결제수에 안 잡히므로 그 규모가 보여야 한다.
                */}
                <div
                  className="absolute inset-y-0 left-0 bg-primary/70"
                  style={{ width: `${(r.리드있음 / max) * 100}%` }}
                />
                <div
                  className="absolute inset-y-0 bg-amber-400/80 dark:bg-amber-500/70"
                  style={{
                    left: `${(r.리드있음 / max) * 100}%`,
                    width: `${(r.리드없음 / max) * 100}%`,
                  }}
                />
              </div>
              <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {r.결제}건 · {r.비중_pct}%
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary/70" />
            리드 있음
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400/80 dark:bg-amber-500/70" />
            리드 없음 {data.총리드없음}건
          </span>
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          리드 없음은 에어테이블에 리드가 없어 위 결제수에는 안 잡히는 건이다(오가닉·키퍼맨·
          B2B 영업 등). 월 KPI는 채널을 가리지 않고 전량을 세므로 이 건들도 포함한다.
        </p>
      </CardContent>
    </Card>
  );
}

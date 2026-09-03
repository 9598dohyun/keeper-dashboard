'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import MetricCard from './metric-card';
import type { KpiMonth, KpiDay } from '@/lib/kpi/types';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

const 요일명 = ['일', '월', '화', '수', '목', '금', '토'];

/** 달성 상태별 셀 색 */
function cellStyle(d: KpiDay): string {
  if (d.공휴일) return 'bg-muted/60 text-muted-foreground';
  if (!d.영업일) return 'bg-muted/30 text-muted-foreground';
  if (d.실적 === null) return 'bg-card'; // 아직 안 온 날
  if (d.차이 !== null && d.차이 >= 0) return 'bg-green-50 dark:bg-green-950/40';
  return 'bg-red-50 dark:bg-red-950/40';
}

export default function KpiCalendar() {
  const [data, setData] = useState<KpiMonth | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/kpi')
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : '조회 실패'));
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        <Alert variant="destructive">
          <AlertDescription>오류: {error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  // 1일이 무슨 요일인지에 맞춰 앞을 비운다
  const 앞여백 = data.일별.length ? data.일별[0].요일 : 0;
  const 초과 = data.격차 >= 0;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {Number(data.월.slice(5))}월 KPI
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            목표 {data.목표.toLocaleString()}건 · 영업일 {data.영업일수}일 · 하루 {data.일목표}건
            {' · '}기준 {data.기준일}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/diagnosis" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            전환율 진단
          </Link>
          <Link href="/dashboard" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            대시보드
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          title="누적 실적"
          value={data.누적실적.toLocaleString()}
          unit="건"
          sub={`목표 ${data.목표.toLocaleString()}건 중 ${data.달성률_pct}%`}
          color="blue"
        />
        <MetricCard
          title={초과 ? '목표 대비 초과' : '목표 대비 부족'}
          value={`${초과 ? '+' : ''}${data.격차.toLocaleString()}`}
          unit="건"
          sub={`오늘까지 목표 ${data.누적목표.toLocaleString()}건`}
          color={초과 ? 'green' : 'red'}
        />
        <MetricCard
          title="하루 필요"
          value={data.필요일평균?.toLocaleString() ?? '—'}
          unit="건"
          sub={`남은 ${data.잔여영업일}영업일 · 잔여 ${data.잔여.toLocaleString()}건`}
          color="yellow"
        />
        <MetricCard
          title="예상 착지"
          value={data.예상착지.toLocaleString()}
          unit="건"
          sub={
            data.예상착지 >= data.목표
              ? `목표 +${(data.예상착지 - data.목표).toLocaleString()}`
              : `목표 ${(data.예상착지 - data.목표).toLocaleString()}`
          }
          color={data.예상착지 >= data.목표 ? 'green' : 'red'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">일별 목표 대비 달성</CardTitle>
          <CardDescription>
            목표는 영업일에만 배분한다(주말·법정공휴일 제외). 초록은 목표 달성, 빨강은 미달,
            흰 칸은 아직 데이터가 없는 날.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
            {요일명.map((w, i) => (
              <div key={w} className={`py-1 ${i === 0 ? 'text-red-600' : i === 6 ? 'text-blue-600' : ''}`}>
                {w}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: 앞여백 }, (_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {data.일별.map((d) => {
              const 일 = Number(d.날짜.slice(8));
              const 오늘 = d.날짜 === data.기준일;
              return (
                <div
                  key={d.날짜}
                  className={`min-h-[74px] rounded-md border p-1.5 text-left ${cellStyle(d)} ${
                    오늘 ? 'border-primary ring-1 ring-primary' : 'border-border'
                  }`}
                >
                  <div className="flex items-baseline justify-between">
                    <span
                      className={`text-xs font-semibold tabular-nums ${
                        d.요일 === 0 || d.공휴일
                          ? 'text-red-600'
                          : d.요일 === 6
                            ? 'text-blue-600'
                            : 'text-foreground'
                      }`}
                    >
                      {일}
                    </span>
                    {d.영업일 && (
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {d.목표}
                      </span>
                    )}
                  </div>

                  {d.공휴일 ? (
                    <p className="mt-1 text-[10px] leading-tight">{d.공휴일}</p>
                  ) : d.실적 !== null ? (
                    <>
                      <p className="mt-0.5 text-base font-bold tabular-nums leading-none text-foreground">
                        {d.실적}
                      </p>
                      {d.영업일 && d.차이 !== null && (
                        <p
                          className={`text-[10px] font-semibold tabular-nums ${
                            d.차이 >= 0 ? 'text-green-700 dark:text-green-400' : 'text-destructive'
                          }`}
                        >
                          {d.차이 >= 0 ? '+' : ''}
                          {d.차이}
                        </p>
                      )}
                      {!d.영업일 && d.실적 > 0 && (
                        <p className="text-[10px] text-muted-foreground">휴무 유입</p>
                      )}
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-3 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
            <p>
              칸의 오른쪽 위 작은 숫자가 그날 목표, 큰 숫자가 실적이다. 주말·공휴일은 목표를
              배분하지 않지만 결제가 들어오면 실적에 잡히고 누적에 더해진다.
            </p>
            <p>
              하루 목표 {data.일목표}건은 {data.목표.toLocaleString()} ÷ 영업일 {data.영업일수}일로
              계산한 것이다. 공휴일은 관보 기준으로 자동 반영된다.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

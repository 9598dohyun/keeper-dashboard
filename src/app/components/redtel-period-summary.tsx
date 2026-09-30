'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { RedtelOBPeriodSummary, PeriodKind } from '@/lib/metrics2/period';

interface Props {
  kind: PeriodKind;
  period: string | null;
}

function Stat({ label, value, hint, accent }: { label: string; value: string | number; hint?: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold tracking-tight tabular-nums ${accent ? 'text-chart-3' : 'text-foreground'}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * 레드텔레콤 O/B는 응대·전환·담당자·유입 지표가 없는 결제 건수 전용 소스라 별도 뷰를 쓴다.
 * 결제 건수는 계산 시점 전체 누적이라 기간과 무관하게 항상 같은 값이 나온다.
 */
export default function RedtelPeriodSummaryView({ kind, period }: Props) {
  const [data, setData] = useState<RedtelOBPeriodSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const periodParam = period ? `&period=${encodeURIComponent(period)}` : '';
    fetch(`/api/metrics-v2?type=period&kind=${kind}${periodParam}&table=레드텔레콤_OB`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: RedtelOBPeriodSummary) => setData(json))
      .catch((e) => setError(e instanceof Error ? e.message : '조회 실패'))
      .finally(() => setLoading(false));
  }, [kind, period]);

  if (loading) return <Skeleton className="h-24 w-full rounded-xl" />;

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>기간 데이터를 불러오지 못했습니다. {error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {data.기간.시작} ~ {data.기간.끝} · 스냅샷 {data.일수}일치 합산
      </p>
      <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
        <Stat
          label="결제 건수"
          value={`${data.결제.toLocaleString()}건`}
          accent
          hint="[콜]최종 결과 == 결제 완료 · 전체 누적(기간과 무관)"
        />
      </div>
    </div>
  );
}

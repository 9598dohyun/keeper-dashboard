'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { PeriodSummary, PeriodKind, TableKey } from '@/lib/metrics2/period';

interface Props {
  kind: PeriodKind;
  period: string | null;
  table: TableKey;
}

/** 큰 숫자 하나 */
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

export default function PeriodSummaryView({ kind, period, table }: Props) {
  const [data, setData] = useState<PeriodSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const periodParam = period ? `&period=${encodeURIComponent(period)}` : '';
    fetch(`/api/metrics-v2?type=period&kind=${kind}${periodParam}&table=${encodeURIComponent(table)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: PeriodSummary) => setData(json))
      .catch((e) => setError(e instanceof Error ? e.message : '조회 실패'))
      .finally(() => setLoading(false));
  }, [kind, period, table]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>기간 데이터를 불러오지 못했습니다. {error}</AlertDescription>
      </Alert>
    );
  }

  if (data.일수 === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {data.기간.시작} ~ {data.기간.끝} 기간에 저장된 스냅샷이 없습니다.
      </p>
    );
  }

  const 분해: { label: string; value: number; variant: 'secondary' | 'destructive' | 'outline' }[] = [
    { label: '결제', value: data.분해.결제, variant: 'secondary' },
    { label: '실패', value: data.분해.실패, variant: 'destructive' },
    { label: '중복문의', value: data.분해.중복문의, variant: 'outline' },
    { label: 'B2B', value: data.분해.B2B, variant: 'outline' },
    { label: '미확정', value: data.분해.미확정, variant: 'outline' },
  ];

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        {data.기간.시작} ~ {data.기간.끝} · 스냅샷 {data.일수}일치 합산
      </p>

      <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
        <Stat label="응대" value={`${data.응대.toLocaleString()}건`} />
        <Stat
          label="결제"
          value={`${data.결제.toLocaleString()}건`}
          accent
          hint={data.전환율_pct === null ? '결제 데이터 엑셀 기준' : undefined}
        />
        {data.전환율_pct !== null && (
          <Stat label="전환율" value={`${data.전환율_pct}%`} hint={`결제 ${data.결제} ÷ 응대 ${data.응대}`} />
        )}
        {data.재컨택 && !data.재컨택.이력없음 && (
          <Stat
            label="재컨택률"
            value={`${data.재컨택.재컨택률_pct}%`}
            hint={`재컨택 ${data.재컨택.재컨택} ÷ 응대 ${data.재컨택.신규 + data.재컨택.재컨택}`}
          />
        )}
        <Stat label="유입" value={`${data.유입.toLocaleString()}건`} />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <span className="text-xs text-muted-foreground">응대건 처리 상태</span>
        {분해.map((d) => (
          <Badge key={d.label} variant={d.variant} className="tabular-nums">
            {d.label} {d.value}
          </Badge>
        ))}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-foreground">담당자별</p>
        {data.담당자별.length === 0 ? (
          <p className="text-sm text-muted-foreground">응대 기록 없음</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>담당자</TableHead>
                  <TableHead className="text-right">응대</TableHead>
                  <TableHead className="text-right">결제</TableHead>
                  <TableHead className="text-right">전환율</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.담당자별.map((r) => (
                  <TableRow key={r.담당자}>
                    <TableCell className="font-medium whitespace-nowrap">{r.담당자}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.응대}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.결제}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {r.전환율_pct === null ? '—' : `${r.전환율_pct}%`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {data.채널_Top.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-foreground">채널별 유입 Top {data.채널_Top.length}</p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>채널</TableHead>
                  <TableHead className="text-right">유입</TableHead>
                  <TableHead className="text-right">결제</TableHead>
                  <TableHead className="text-right">전환율</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.채널_Top.map((c) => (
                  <TableRow key={c.채널}>
                    <TableCell className="whitespace-nowrap">{c.채널}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.유입}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.결제 === undefined ? '—' : c.결제}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {c.전환율_pct === null ? '—' : `${c.전환율_pct}%`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            결제는 유입일 기준 코호트 전환(그 채널로 유입된 리드 중 지금까지 결제된 건수) —
            결제 데이터 엑셀 대조가 없으면 &apos;—&apos;로 표시
          </p>
        </div>
      )}
    </div>
  );
}

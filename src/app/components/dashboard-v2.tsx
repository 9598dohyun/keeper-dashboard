'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import ChannelChart from './channel-chart';
import TrendLines from './trend-lines';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type {
  DashboardV2 as DashboardV2Data,
  ConversionMetrics,
  AssigneeMetric,
  TrendPoint,
  DailyCount,
} from '@/lib/metrics2/types';

type TableKey = '인바운드' | 'skb';

/** 큰 숫자 하나 — 지표 카드의 공통 단위 */
function Stat({
  label,
  value,
  hint,
  accent,
  size = 'lg',
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
  size?: 'lg' | 'md';
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p
        className={`font-bold tracking-tight tabular-nums ${
          size === 'lg' ? 'text-4xl' : 'text-2xl'
        } ${accent ? 'text-chart-3' : 'text-foreground'}`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * 응대·결제 지표.
 * 둘은 세는 대상이 달라(오늘 결제한 건이 오늘 응대한 건이 아닐 수 있음)
 * 나눈 값을 전환율로 쓰지 않고 건수를 나란히 둔다.
 */
function ConversionHero({ 전환 }: { 전환: ConversionMetrics }) {
  const 분해: { label: string; value: number; variant: 'secondary' | 'destructive' | 'outline' }[] =
    [
      { label: '결제', value: 전환.분해.결제, variant: 'secondary' },
      { label: '실패', value: 전환.분해.실패, variant: 'destructive' },
      { label: '중복문의', value: 전환.분해.중복문의, variant: 'outline' },
      { label: 'B2B', value: 전환.분해.B2B, variant: 'outline' },
      { label: '미확정', value: 전환.분해.미확정, variant: 'outline' },
    ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
        <Stat
          label="오늘 응대"
          value={전환.응대}
          hint={
            전환.재컨택 && !전환.재컨택.이력없음
              ? `신규 ${전환.재컨택.신규} · 재컨택 ${전환.재컨택.재컨택}`
              : '메모를 남긴 리드 수'
          }
        />
        <Stat
          label="오늘 결제"
          value={전환.결제}
          accent
          hint={전환.전환율_pct === null ? '결제 데이터 엑셀 기준' : '에어테이블 최종결과 기준'}
        />
        {전환.전환율_pct !== null && (
          <Stat
            label="전환율"
            value={`${전환.전환율_pct}%`}
            size="md"
            hint={`결제 ${전환.결제} ÷ 응대 ${전환.응대}`}
          />
        )}
        {/* 재컨택률은 응대건 안에서의 비율이라 모집단이 같다 — 전환율과 달리 비율로 성립한다 */}
        {전환.재컨택 && !전환.재컨택.이력없음 && (
          <Stat
            label="재컨택률"
            value={`${전환.재컨택.재컨택률_pct}%`}
            size="md"
            hint={`재컨택 ${전환.재컨택.재컨택} ÷ 응대 ${전환.응대}`}
          />
        )}
      </div>

      {전환.재컨택?.이력없음 && (
        <p className="text-xs text-muted-foreground">
          재컨택은 접촉이력이 쌓인 다음 날부터 집계된다. 오늘은 이력 첫 수집일이라 전부 신규로
          잡힌다.
        </p>
      )}

      {전환.전환율_pct === null && (
        <p className="text-xs text-muted-foreground">
          응대와 결제는 세는 대상이 달라(오늘 결제한 건이 오늘 응대한 건이 아닐 수 있음) 나눈 값을
          전환율로 쓰지 않고 건수만 표시한다.
        </p>
      )}

      {전환.재컨택 && !전환.재컨택.이력없음 && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <span className="text-xs text-muted-foreground">응대건 접촉 구분</span>
          <Badge variant="outline" className="tabular-nums">
            신규 {전환.재컨택.신규}
          </Badge>
          <Badge variant="secondary" className="tabular-nums">
            재컨택 {전환.재컨택.재컨택}
          </Badge>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <span className="text-xs text-muted-foreground">응대건 처리 상태</span>
        {분해.map((d) => (
          <Badge key={d.label} variant={d.variant} className="tabular-nums">
            {d.label} {d.value}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function AssigneeTable({ rows }: { rows: AssigneeMetric[] }) {
  if (!rows || rows.length === 0) {
    return <p className="text-sm text-muted-foreground">오늘 응대 기록 없음</p>;
  }
  const max = Math.max(...rows.map((r) => r.응대), 1);
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>담당자</TableHead>
            <TableHead className="w-32">응대량</TableHead>
            <TableHead className="text-right">응대</TableHead>
            <TableHead className="text-right">결제</TableHead>
            <TableHead className="text-right">전환율</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.담당자}>
              <TableCell className="font-medium whitespace-nowrap">{r.담당자}</TableCell>
              <TableCell>
                <span className="block h-2 overflow-hidden rounded-sm bg-muted">
                  <span
                    className="block h-full rounded-sm bg-chart-1"
                    style={{ width: `${(r.응대 / max) * 100}%` }}
                  />
                </span>
              </TableCell>
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
  );
}

/**
 * 날짜별 유입 막대.
 * 누적 숫자 하나로는 "언제 많이 들어왔나"를 알 수 없어 일자 분포를 함께 보여준다.
 */
function DailyInflowBars({ data }: { data: DailyCount[] }) {
  const max = Math.max(...data.map((d) => d.건수), 1);
  const 최근 = data.slice(-30);
  return (
    <div>
      <div
        className="flex h-24 items-end gap-[2px]"
        role="img"
        aria-label="날짜별 유입 분포"
      >
        {최근.map((d) => (
          <div
            key={d.날짜}
            className="group relative flex h-full flex-1 flex-col justify-end"
            style={{ maxWidth: 최근.length < 8 ? 48 : undefined }}
          >
            <div
              className="min-h-[2px] w-full rounded-t-[2px] bg-chart-1 transition-opacity group-hover:opacity-80"
              style={{ height: `${(d.건수 / max) * 100}%` }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background group-hover:block">
              {d.날짜} · {d.건수}건
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{최근[0]?.날짜.slice(5)}</span>
        <span>{최근[최근.length - 1]?.날짜.slice(5)}</span>
      </div>
    </div>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {desc && <CardDescription>{desc}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function DashboardV2() {
  const [data, setData] = useState<DashboardV2Data | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [table, setTable] = useState<TableKey>('인바운드');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (date: string) => {
    try {
      const url = date ? `/api/metrics-v2?date=${date}` : '/api/metrics-v2';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as DashboardV2Data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터 조회 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch('/api/metrics-v2?type=dates')
      .then((res) => (res.ok ? res.json() : []))
      .then((list: string[]) => setDates(Array.isArray(list) ? list : []))
      .catch(() => setDates([]));

    fetch('/api/metrics-v2?type=trend&days=30')
      .then((res) => (res.ok ? res.json() : []))
      .then((list: TrendPoint[]) => setTrend(Array.isArray(list) ? list : []))
      .catch(() => setTrend([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData(selectedDate);
  }, [fetchData, selectedDate]);

  const 갱신 = data?._meta?.updatedAt
    ? new Date(data._meta.updatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    : '';

  const 결제소스 = data?._meta.결제소스;
  // base-ui Select는 items에 {label, value} 형태를 받는다
  const 날짜옵션 = [
    { label: `최신 (${dates[0]})`, value: '__latest__' },
    ...dates.map((d) => ({ label: d, value: d })),
  ];

  const 헤더 = (
    <header className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">SKB+인바운드 통합 대시보드</h1>
          {data && (
            <p className="mt-1 text-xs text-muted-foreground">
              집계 {data.집계시작} 이후 · 응대/전환은 {data.오늘} 기준(메모 수정 시각) · 갱신{' '}
              {갱신}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dates.length > 0 && (
            <Select
              items={날짜옵션}
              value={selectedDate || '__latest__'}
              onValueChange={(v: string | null) =>
                setSelectedDate(!v || v === '__latest__' ? '' : v)
              }
            >
              <SelectTrigger size="sm" className="w-[180px]" aria-label="조회 날짜 선택">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__latest__">최신 ({dates[0]})</SelectItem>
                {dates.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Link
            href="/diagnosis"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            전환율 진단 →
          </Link>
        </div>
      </div>

      {결제소스 && 결제소스.종류 !== 'excel' && (
        <Alert>
          <AlertDescription>
            결제수가 에어테이블 최종결과 기준입니다 (결제 데이터 엑셀 미반영).
          </AlertDescription>
        </Alert>
      )}
      {결제소스?.종류 === 'excel' && 결제소스.기준일 !== data?.오늘 && (
        <Alert variant="destructive">
          <AlertDescription>
            결제 엑셀 기준일({결제소스.기준일})이 집계일({data?.오늘})과 다릅니다.
          </AlertDescription>
        </Alert>
      )}

      {data && (
        <Tabs value={table} onValueChange={(v: string) => setTable(v as TableKey)}>
          <TabsList>
            {(['인바운드', 'skb'] as TableKey[]).map((k) => (
              <TabsTrigger key={k} value={k}>
                {k === 'skb' ? 'SKB' : '인바운드'}
                <span className="ml-1.5 text-muted-foreground tabular-nums">
                  {data[k].전환.전환율_pct === null
                    ? `결제 ${data[k].전환.결제}`
                    : `${data[k].전환.전환율_pct}%`}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
    </header>
  );

  if (loading || error || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        {헤더}
        {loading ? (
          <div className="space-y-5">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : (
          <Alert variant="destructive">
            <AlertDescription>데이터를 불러오지 못했습니다. {error}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  const cur = data[table];
  const 이름 = table === 'skb' ? 'SKB' : '인바운드';
  const 일자별유입 = cur.유입_일자별 ?? [];
  // 보고 있는 날(data.오늘)의 유입. 날짜 드롭박스로 과거를 보면 그날 값이 나온다.
  const 선택일 = data.오늘;
  const 최신일 = dates[0] ?? data.오늘;
  const 당일유입 = 일자별유입.find((d) => d.날짜 === 선택일)?.건수 ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      {헤더}

      <Section title={`${이름} · 오늘`} desc={`${data.오늘} 응대 기준`}>
        <ConversionHero 전환={cur.전환} />
      </Section>

      <Section
        title="날짜별 추이"
        desc="누적이 아닌 그날 값. 지표마다 단위가 달라 축을 나눠 그린다. 응대 기준을 메모 수정 시각으로 바꾼 2026-08-26부터 표시한다."
      >
        <TrendLines data={trend} table={table} />
      </Section>

      <Section title="담당자별" desc={`${data.오늘} 응대 기준`}>
        <AssigneeTable rows={cur.담당자별} />
      </Section>

      <Section title="유입" desc="유입시간 기준 · 일 평균은 집계 시작 이후 전체 평균">
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
            <Stat
              label={`${선택일 === 최신일 ? '오늘' : 선택일} 유입`}
              value={당일유입 === null ? '—' : `${당일유입.toLocaleString()}건`}
              size="md"
            />
            {일자별유입.length > 0 && (
              <Stat
                label="일 평균"
                value={`${Math.round(
                  일자별유입.reduce((s, d) => s + d.건수, 0) / 일자별유입.length
                ).toLocaleString()}건`}
                size="md"
              />
            )}
          </div>

          {일자별유입.length > 1 && <DailyInflowBars data={일자별유입} />}

          {table === '인바운드' && <ChannelChart data={data.인바운드.채널_Top} />}
        </div>
      </Section>

      <Section title="레드텔레콤" desc="규모만 모니터링">
        <div className="flex gap-8">
          <Stat label="전체" value={data.레드텔레콤.건수_전체.toLocaleString()} size="md" />
          <Stat
            label="집계 시작 이후"
            value={data.레드텔레콤.건수_오늘이후.toLocaleString()}
            size="md"
          />
        </div>
      </Section>

      <p className="pb-4 text-center text-[10px] text-muted-foreground">
        한화비전 키퍼 · SKB+인바운드 통합관리
      </p>
    </div>
  );
}

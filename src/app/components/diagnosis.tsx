'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import MetricCard from './metric-card';
import StaleLeads from './stale-leads';
import SegmentTable from './segment-table';
import LeadTimeChart from './leadtime-chart';
import type {
  DiagnosisResult,
  DiagnosisTable,
  TimeSegment,
  SourceAxis,
} from '@/lib/metrics3/types';
import { SEGMENT_LABEL, SEGMENT_ORDER } from '@/lib/metrics3/time-segment';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type TableKey = '인바운드' | 'skb';
type SegFilter = '전체' | TimeSegment;

const RANGES = [30, 60, 90] as const;
/** 채널·담당자 표에서 표본 부족 행을 감추는 기준 */
const MIN_VOLUME = 30;

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

export default function Diagnosis() {
  const [range, setRange] = useState<number>(90);
  const [table, setTable] = useState<TableKey>('인바운드');
  const [seg, setSeg] = useState<SegFilter>('전체');
  const [axis, setAxis] = useState<SourceAxis>('utm');
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(''); // '' = 최신
  const [data, setData] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (r: number, date: string) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ range: String(r) });
      if (date) qs.set('date', date);
      const res = await fetch(`/api/diagnosis?${qs}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setData((await res.json()) as DiagnosisResult);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터 조회 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(range, selectedDate);
  }, [fetchData, range, selectedDate]);

  // 스냅샷 날짜 목록은 최초 1회만 로드
  useEffect(() => {
    fetch('/api/diagnosis?type=dates')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: string[]) => setDates(Array.isArray(d) ? d : []))
      .catch(() => setDates([]));
  }, []);

  const t: DiagnosisTable | null = data ? data[table] : null;

  const sourceRows = useMemo(() => {
    if (!t) return [];
    if (axis === 'utm') return t.매체별;
    if (axis === 'entry') return t.유입페이지별;
    return t.교차별;
  }, [t, axis]);

  // 시간대 필터는 세그먼트 표에서 해당 행만 남기는 방식으로 적용한다.
  // 채널·담당자·방치 리드는 리드 단위 필터가 필요하므로 방치 리드에만 적용.
  const 방치리드 = useMemo(() => {
    if (!t) return [];
    return seg === '전체' ? t.방치리드 : t.방치리드.filter((l) => l.시간대 === seg);
  }, [t, seg]);

  const 방치버킷 = useMemo(() => {
    if (!t) return [];
    if (seg === '전체') return t.방치버킷;
    // 필터 적용 시 목록 기준으로 버킷 재집계 (목록은 상한이 있으므로 근사치)
    const count = new Map<string, number>();
    for (const l of 방치리드) count.set(l.버킷, (count.get(l.버킷) ?? 0) + 1);
    return t.방치버킷
      .map((b) => ({ ...b, 건수: count.get(b.버킷) ?? 0 }))
      .filter((b) => b.건수 > 0);
  }, [t, seg, 방치리드]);

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 p-4 sm:p-6">
        <Alert variant="destructive">
          <AlertDescription>오류: {error}</AlertDescription>
        </Alert>
        <Button variant="outline" size="sm" onClick={() => fetchData(range, selectedDate)}>
          다시 시도
        </Button>
      </div>
    );
  }

  if (!data || !t) return null;

  const 조치대상 = t.방치버킷.filter((b) => b.조치대상).reduce((s, b) => s + b.건수, 0);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
          <h1 className="text-xl font-bold text-foreground">전환율 진단</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            유입 기준 · {data.기간.시작} ~ {data.기간.종료} · 갱신{' '}
            {new Date(data.meta.updatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
          </p>
          </div>
          <Link href="/dashboard" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            ← 대시보드
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          <Tabs value={String(range)} onValueChange={(v: string) => setRange(Number(v))}>
            <TabsList>
              {RANGES.map((r) => (
                <TabsTrigger key={r} value={String(r)}>
                  최근 {r}일
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Tabs value={table} onValueChange={(v: string) => setTable(v as TableKey)}>
            <TabsList>
              {(['인바운드', 'skb'] as TableKey[]).map((k) => {
                const stat = data[k].전체;
                return (
                  <TabsTrigger key={k} value={k}>
                    {k === 'skb' ? 'SKB' : '인바운드'}
                    <span className="ml-1.5 text-muted-foreground tabular-nums">
                      {stat.유입.toLocaleString()}건 · {stat.유입대비_pct}%
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>

          <Tabs value={seg} onValueChange={(v: string) => setSeg(v as SegFilter)}>
            <TabsList>
              {(['전체', ...SEGMENT_ORDER] as SegFilter[]).map((x) => (
                <TabsTrigger key={x} value={x}>
                  {x}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {dates.length > 0 && (
          <div className="flex items-center gap-2">
            <Label htmlFor="d3-date" className="text-xs font-semibold">
              기준일
            </Label>
            <Select
              items={[
                { label: '최신', value: '__latest__' },
                ...dates.map((d) => ({ label: d, value: d })),
              ]}
              value={selectedDate || '__latest__'}
              onValueChange={(v: string | null) =>
                setSelectedDate(!v || v === '__latest__' ? '' : v)
              }
            >
              <SelectTrigger id="d3-date" size="sm" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__latest__">최신</SelectItem>
                {dates.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedDate && (
              <span className="text-[11px] text-muted-foreground">
                {selectedDate} 마감 시점 스냅샷
              </span>
            )}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          이 화면은 유입 시점 기준으로 리드의 처리 상태를 봅니다. 대시보드의 당일 성과 지표
          (오늘 결제 ÷ 오늘 응대)와는 분모가 달라 수치가 일치하지 않습니다.
          {' '}날짜별 스냅샷은 {data.meta.스냅샷_시작}부터 하루 1건(KST 23:59 마감)씩 쌓입니다.
        </p>
      </header>

      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-bold text-foreground">
          {table === 'skb' ? 'SKB' : '인바운드'}
        </h2>
        <span className="text-xs text-muted-foreground">
          {table === 'skb'
            ? 'SK브로드밴드 종료고객 대상 — 유입 대부분이 운영시간에 집중'
            : '광고·홈페이지 유입'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          title="유입"
          value={t.전체.유입.toLocaleString()}
          unit="건"
          color="blue"
        />
        <MetricCard
          title="결제"
          value={t.전체.결제.toLocaleString()}
          unit="건"
          sub={`유입대비 ${t.전체.유입대비_pct}% / 종결대비 ${t.전체.종결대비_pct}%`}
          color="green"
        />
        <MetricCard
          title="미확정"
          value={t.전체.미확정.toLocaleString()}
          unit="건"
          sub={`${t.전체.미확정률_pct}%`}
          color="yellow"
        />
        <MetricCard
          title="15일+ 방치"
          value={조치대상.toLocaleString()}
          unit="건"
          sub="조치 필요"
          color="red"
        />
      </div>

      <Section
        title="방치 리드"
        desc="미확정 상태로 남아 있는 리드. 15일 초과 시 전환율이 7%대로 떨어진다(실측)."
      >
        <StaleLeads 버킷={방치버킷} 리드={방치리드} 제외건수={t.방치_제외건수} />
      </Section>

      <Section
        title="유입 시간대별"
        desc={`${SEGMENT_LABEL.운영시간} 기준. 응대 체계가 다르므로 합산하지 않는다.`}
      >
        <SegmentTable rows={t.시간대별} keyLabel="시간대" />
      </Section>

      <Section
        title="유입 출처"
        desc="광고 매체(UTM_source)와 유입 페이지(진입경로)는 다른 축이라 분리해서 본다."
      >
        <div className="flex rounded-lg border overflow-hidden w-fit mb-3">
          {(
            [
              ['utm', '매체'],
              ['entry', '유입페이지'],
              ['cross', '매체 × 유입페이지'],
            ] as [SourceAxis, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setAxis(k)}
              className={`px-3 py-1.5 text-xs font-semibold ${
                axis === k ? 'bg-foreground text-white' : 'bg-card hover:bg-muted/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <SegmentTable
          rows={sourceRows}
          keyLabel={axis === 'utm' ? '매체' : axis === 'entry' ? '유입페이지' : '매체 × 유입페이지'}
          minVolume={axis === 'cross' ? MIN_VOLUME : 20}
          limit={axis === 'cross' ? 25 : undefined}
        />
      </Section>

      <Section title="담당자별" desc={`유입 ${MIN_VOLUME}건 이상`}>
        <SegmentTable rows={t.담당자별} keyLabel="담당자" minVolume={MIN_VOLUME} />
      </Section>

      <Section title="응대 속도" desc="유입 → 첫 응대">
        <LeadTimeChart data={t.리드타임} 집계시작={data.meta.리드타임_집계시작} />
      </Section>

      <Section
        title="실패사유"
        desc={`실패 ${t.실패사유_기재.실패총건.toLocaleString()}건 중 ${t.실패사유_기재.기재.toLocaleString()}건 기재 (기재율 ${t.실패사유_기재.기재율_pct}%)`}
      >
        {t.실패사유.length === 0 ? (
          <p className="text-sm text-muted-foreground">데이터 없음</p>
        ) : (
          <div className="space-y-1.5">
            {t.실패사유.map((f) => {
              const max = t.실패사유[0].건수 || 1;
              return (
                <div key={f.사유} className="flex items-center gap-3">
                  <span className="w-48 shrink-0 text-xs text-foreground truncate" title={f.사유}>
                    {f.사유}
                  </span>
                  <span className="flex-1 h-5 bg-muted rounded overflow-hidden">
                    <span
                      className="block h-full bg-chart-2 rounded"
                      style={{ width: `${(f.건수 / max) * 100}%` }}
                    />
                  </span>
                  <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {f.건수.toLocaleString()}건 ({f.비중_pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

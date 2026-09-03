'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import MetricCard from './metric-card';
import StaleLeads from './stale-leads';
import SegmentTable from './segment-table';
import LeadTimeChart from './leadtime-chart';
import DailyCommentPanel from './daily-comment';
import type {
  DiagnosisResult,
  DiagnosisTable,
  TimeSegment,
  SourceAxis,
} from '@/lib/metrics3/types';
import type { DailyComment } from '@/lib/metrics3/comment';
import { SEGMENT_LABEL, SEGMENT_ORDER } from '@/lib/metrics3/time-segment';
import { 접촉_집계시작 } from '@/lib/constants';
import { Button, buttonVariants } from '@/components/ui/button';
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

type TableKey = '인바운드' | 'skb';
type SegFilter = '전체' | TimeSegment;

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

type PeriodKind = 'day' | 'week' | 'month';
interface PeriodOpt {
  id: string;
  label: string;
  시작: string;
  종료: string;
}

const KIND_LABEL: Record<PeriodKind, string> = {
  day: '일간',
  week: '주별',
  month: '월별',
};

export default function Diagnosis() {
  const [kind, setKind] = useState<PeriodKind>('day');
  const [periods, setPeriods] = useState<PeriodOpt[]>([]);
  /**
   * 선택된 기간을 종류와 함께 들고 있는다.
   * 따로 두면 종류를 바꾼 직후 목록이 오기 전에 이전 종류의 id로 조회해 404가 난다.
   */
  const [sel, setSel] = useState<{ kind: PeriodKind; id: string } | null>(null);
  const [table, setTable] = useState<TableKey>('인바운드');
  const [seg, setSeg] = useState<SegFilter>('전체');
  const [axis, setAxis] = useState<SourceAxis>('utm');
  const [data, setData] = useState<DiagnosisResult | null>(null);
  /** 일자별 코멘트. 일간 조회일 때만 채워진다 */
  const [comment, setComment] = useState<{
    날짜: string;
    인바운드: DailyComment | null;
    skb: DailyComment | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (k: PeriodKind, id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ kind: k, period: id });
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

  // 기간 종류가 바뀌면 목록을 새로 받고 가장 최근 기간을 고른다
  useEffect(() => {
    let alive = true;
    fetch(`/api/diagnosis?kind=${kind}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: PeriodOpt[]) => {
        if (!alive) return;
        const arr = Array.isArray(list) ? list : [];
        setPeriods(arr);
        setSel(arr[0] ? { kind, id: arr[0].id } : null);
      })
      .catch(() => {
        if (alive) {
          setPeriods([]);
          setSel(null);
        }
      });
    return () => {
      alive = false;
    };
  }, [kind]);

  useEffect(() => {
    // sel.kind !== kind 인 순간(종류 전환 직후)은 목록을 기다린다
    if (!sel || sel.kind !== kind) return;
    fetchData(sel.kind, sel.id);
  }, [fetchData, kind, sel]);

  /*
   * 코멘트는 하루 단위로만 만든다. 주·월을 고르면 여러 날이 섞여
   * "그날 무엇이 막혔나"라는 질문 자체가 성립하지 않으므로 감춘다.
   */
  useEffect(() => {
    if (kind !== 'day' || !sel || sel.kind !== 'day') return;
    const 날짜 = sel.id;
    let alive = true;
    fetch(`/api/diagnosis?type=comment&date=${날짜}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        if (alive) setComment(c ? { ...c, 날짜 } : null);
      })
      .catch(() => {
        if (alive) setComment(null);
      });
    return () => {
      alive = false;
    };
  }, [kind, sel]);

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
        <Button variant="outline" size="sm" onClick={() => sel && fetchData(sel.kind, sel.id)}>
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
          <div className="flex gap-2">
            <Link href="/kpi" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              월 KPI
            </Link>
            <Link href="/dashboard" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              ← 대시보드
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Tabs value={kind} onValueChange={(v: string) => setKind(v as PeriodKind)}>
            <TabsList>
              {(['day', 'week', 'month'] as PeriodKind[]).map((k) => (
                <TabsTrigger key={k} value={k}>
                  {KIND_LABEL[k]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {periods.length > 0 && (
            <Select
              items={periods.map((p) => ({ label: p.label, value: p.id }))}
              value={sel?.id ?? ''}
              onValueChange={(v: string | null) => v && setSel({ kind, id: v })}
            >
              <SelectTrigger size="sm" className="w-[180px]" aria-label="기간 선택">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

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

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          이 화면은 유입 시점 기준으로 리드의 처리 상태를 봅니다. 고른 기간에 유입된 리드가
          지금까지 어떻게 처리됐는지를 보는 것이라, 대시보드의 당일 응대·결제 건수와는 세는
          대상이 달라 수치가 일치하지 않습니다.{' '}
          {data.meta.결제소스 === 'excel'
            ? `결제는 ${data.meta.원장_시작일} 이후 유입분만 결제 데이터 엑셀 기준이고, 그 이전은 에어테이블 최종 결과 기준입니다.`
            : '결제는 에어테이블 최종 결과 기준입니다(결제 엑셀 미반영).'}
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

      {kind === 'day' && comment && comment.날짜 === sel?.id && (
        <DailyCommentPanel data={comment[table]} />
      )}

      {t.재컨택 && t.재컨택.접촉 > 0 && (
        <Section
          title="신규 / 재컨택"
          desc="그날 메모가 수정된 건을 그날 접촉된 건으로 본다. 유입일이 그날이 아니거나, 앞선 날에 이미 응대한 뒤 다시 접촉했으면 재컨택이다."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MetricCard
              title="신규 접촉"
              value={t.재컨택.신규.toLocaleString()}
              unit="건"
              sub={`접촉 ${t.재컨택.접촉}건 중`}
              color="blue"
            />
            <MetricCard
              title="재컨택"
              value={t.재컨택.재컨택.toLocaleString()}
              unit="건"
              sub={`접촉 ${t.재컨택.접촉}건 중 ${t.재컨택.재컨택률_pct}%`}
              color="green"
            />
            <MetricCard
              title="미컨택"
              value={t.재컨택.미컨택.toLocaleString()}
              unit="건"
              sub={`이 기간 유입 중 ${t.재컨택.미컨택률_pct}%`}
              color="red"
            />
          </div>

          <div className="mt-3 space-y-1 text-xs text-gray-500">
            {t.재컨택.재컨택 > 0 && t.재컨택.재컨택_경과일_중앙 !== null && (
              <p>
                재컨택 {t.재컨택.재컨택}건은 유입 후 중앙 {t.재컨택.재컨택_경과일_중앙}일, 최대{' '}
                {t.재컨택.재컨택_경과일_최대}일 지나 다시 접촉됐다.
              </p>
            )}
            {/*
              미컨택은 메모가 아직 없는 건이다. 메모수정시각은 2026-08-26부터 쌓이므로
              그 이전 유입분은 실제로 응대했어도 미컨택으로 잡힌다 — 숨기지 않고 적는다.
            */}
            <p>
              미컨택은 메모가 아직 남지 않은 건이다. 메모 기록은 {접촉_집계시작}부터
              쌓이므로 그 이전에 유입된 리드는 실제로 응대했어도 미컨택으로 잡힌다.
            </p>
            <p>
              접촉 횟수를 센 것이 아니라 그날 건드렸는지만 본다. 메모 기록은 마지막 수정만
              남아 하루에 여러 번 접촉해도 1건이다.
            </p>
          </div>
        </Section>
      )}

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
        desc="광고 매체(UTM_source)와 유입 페이지(진입경로)는 다른 축이라 분리해서 본다. 결제는 유입된 날 바로 결제된 건(당일)과 날이 넘어가 결제된 건(재컨택)으로 나눠 본다."
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

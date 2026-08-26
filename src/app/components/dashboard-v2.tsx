'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import ChannelChart from './channel-chart';
import TrendLines from './trend-lines';
import type {
  DashboardV2 as DashboardV2Data,
  ConversionMetrics,
  AssigneeMetric,
  TrendPoint,
  DailyCount,
} from '@/lib/metrics2/types';

type TableKey = '인바운드' | 'skb';

/**
 * 전환율 헤드라인 — 대시보드가 이끄는 하나의 숫자.
 * 나머지 분해값은 아래 한 줄로 붙여 위계를 만든다.
 */
function ConversionHero({ 전환 }: { 전환: ConversionMetrics }) {
  const 분해 = [
    { label: '결제', value: 전환.분해.결제, tone: 'text-green-700' },
    { label: '실패', value: 전환.분해.실패, tone: 'text-red-600' },
    { label: '중복문의', value: 전환.분해.중복문의, tone: 'text-gray-600' },
    { label: 'B2B', value: 전환.분해.B2B, tone: 'text-gray-600' },
    { label: '미확정', value: 전환.분해.미확정, tone: 'text-amber-600' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <p className="text-xs font-semibold text-gray-500">전환율</p>
          <p className="flex items-baseline gap-1.5">
            <span className="text-5xl font-bold tracking-tight text-gray-900 tabular-nums">
              {전환.전환율_pct}
            </span>
            <span className="text-xl font-semibold text-gray-400">%</span>
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            오늘 결제 {전환.결제} ÷ 오늘 응대 {전환.응대}
          </p>
        </div>

        <div className="flex gap-6">
          <div>
            <p className="text-xs font-semibold text-gray-500">오늘 응대</p>
            <p className="text-2xl font-bold text-gray-900 tabular-nums">{전환.응대}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500">오늘 결제</p>
            <p className="text-2xl font-bold text-green-700 tabular-nums">{전환.결제}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-3 border-t">
        {분해.map((d) => (
          <span key={d.label} className="text-xs">
            <span className="text-gray-500">{d.label}</span>{' '}
            <span className={`font-semibold tabular-nums ${d.tone}`}>{d.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function AssigneeTable({ rows }: { rows: AssigneeMetric[] }) {
  if (!rows || rows.length === 0) {
    return <p className="text-sm text-gray-400">오늘 응대 기록 없음</p>;
  }
  const max = Math.max(...rows.map((r) => r.응대), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b">
            <th className="py-2 pr-4 font-semibold">담당자</th>
            <th className="py-2 px-4 font-semibold">응대량</th>
            <th className="py-2 px-4 font-semibold text-right">응대</th>
            <th className="py-2 px-4 font-semibold text-right">결제</th>
            <th className="py-2 pl-4 font-semibold text-right">전환율</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.담당자} className="border-b border-gray-100">
              <td className="py-2 pr-4 font-medium whitespace-nowrap">{r.담당자}</td>
              <td className="py-2 px-4 w-32">
                <span className="block h-2 bg-gray-100 rounded-sm overflow-hidden">
                  <span
                    className="block h-full bg-blue-500 rounded-sm"
                    style={{ width: `${(r.응대 / max) * 100}%` }}
                  />
                </span>
              </td>
              <td className="py-2 px-4 text-right tabular-nums">{r.응대}</td>
              <td className="py-2 px-4 text-right tabular-nums">{r.결제}</td>
              <td className="py-2 pl-4 text-right font-semibold tabular-nums">
                {r.전환율_pct}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
      <div className="flex items-end gap-[2px] h-24" role="img" aria-label="날짜별 유입 분포">
        {최근.map((d) => (
          <div key={d.날짜} className="flex-1 group relative flex flex-col justify-end h-full">
            <div
              className="w-full bg-blue-500 rounded-t-[2px] min-h-[2px] transition-colors group-hover:bg-blue-600"
              style={{ height: `${(d.건수 / max) * 100}%` }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block whitespace-nowrap rounded bg-gray-900 px-1.5 py-0.5 text-[10px] text-white z-10">
              {d.날짜} · {d.건수}건
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-gray-400">
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
    <section className="bg-white rounded-2xl border shadow-sm p-6 space-y-5">
      <div>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
      </div>
      {children}
    </section>
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

  const 헤더 = (
    <header className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">SKB+인바운드 통합 대시보드</h1>
          {data && (
            <p className="text-xs text-gray-500 mt-1">
              집계 {data.집계시작} 이후 · 응대/전환은 {data.오늘} 기준(메모 수정 시각) · 갱신 {갱신}
              {data._meta.결제소스?.종류 === 'excel' ? (
                <>
                  {' · 결제는 엑셀 기준'}
                  {data._meta.결제소스.기준일 !== data.오늘 &&
                    ` (엑셀 기준일 ${data._meta.결제소스.기준일} — 집계일과 다름)`}
                </>
              ) : (
                ' · 결제는 에어테이블 기준 (엑셀 미반영)'
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dates.length > 0 && (
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-sm border rounded-lg px-3 py-1.5 bg-white shadow-sm"
              aria-label="조회 날짜 선택"
            >
              <option value="">최신 ({dates[0]})</option>
              {dates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
          <Link
            href="/diagnosis"
            className="text-sm font-semibold border rounded-lg px-3 py-1.5 bg-white shadow-sm hover:bg-gray-50 whitespace-nowrap"
          >
            전환율 진단 →
          </Link>
        </div>
      </div>

      {data && (
        <div className="flex rounded-lg border overflow-hidden w-fit">
          {(['인바운드', 'skb'] as TableKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setTable(k)}
              className={`px-4 py-1.5 text-xs font-semibold ${
                table === k ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-50'
              }`}
            >
              {k === 'skb' ? 'SKB' : '인바운드'}
              <span className={table === k ? 'opacity-70' : 'text-gray-400'}>
                {' '}
                {data[k].전환.전환율_pct}%
              </span>
            </button>
          ))}
        </div>
      )}
    </header>
  );

  if (loading || error || !data) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {헤더}
        {loading ? (
          <div className="p-8 text-center text-gray-400">불러오는 중…</div>
        ) : (
          <div className="p-8 text-center text-red-500">
            데이터를 불러오지 못했습니다. {error}
          </div>
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
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
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
        <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
          <div>
            <p className="text-xs font-semibold text-gray-500">
              {선택일 === 최신일 ? '오늘' : 선택일} 유입
            </p>
            <p className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-gray-900 tabular-nums">
                {당일유입 === null ? '—' : 당일유입.toLocaleString()}
              </span>
              <span className="text-sm text-gray-500">건</span>
            </p>
          </div>
          {일자별유입.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500">일 평균</p>
              <p className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold text-gray-900 tabular-nums">
                  {Math.round(
                    일자별유입.reduce((s, d) => s + d.건수, 0) / 일자별유입.length
                  ).toLocaleString()}
                </span>
                <span className="text-sm text-gray-500">건</span>
              </p>
            </div>
          )}
        </div>

        {일자별유입.length > 1 && <DailyInflowBars data={일자별유입} />}

        {table === '인바운드' && <ChannelChart data={data.인바운드.채널_Top} />}
      </Section>

      <Section title="레드텔레콤" desc="규모만 모니터링">
        <div className="flex gap-8">
          <div>
            <p className="text-xs font-semibold text-gray-500">전체</p>
            <p className="text-2xl font-bold text-gray-900 tabular-nums">
              {data.레드텔레콤.건수_전체.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500">집계 시작 이후</p>
            <p className="text-2xl font-bold text-gray-900 tabular-nums">
              {data.레드텔레콤.건수_오늘이후.toLocaleString()}
            </p>
          </div>
        </div>
      </Section>

      <div className="text-center text-[10px] text-gray-300 pb-4">
        한화비전 키퍼 · SKB+인바운드 통합관리
      </div>
    </div>
  );
}

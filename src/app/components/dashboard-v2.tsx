'use client';

import { useEffect, useState, useCallback } from 'react';
import MetricCard from './metric-card';
import ChannelChart from './channel-chart';
import type { DashboardV2 as DashboardV2Data, ConversionMetrics, AssigneeMetric } from '@/lib/metrics2/types';

function ConversionBlock({ 전환 }: { 전환: ConversionMetrics }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <MetricCard
        title="전환율 (오늘결제 ÷ 오늘응대)"
        value={전환.전환율_pct}
        unit="%"
        sub={`결제 ${전환.결제} / 응대 ${전환.응대}`}
        color="green"
      />
      <MetricCard title="오늘 응대" value={전환.응대} unit="건" color="blue" />
      <MetricCard title="오늘 결제" value={전환.결제} unit="건" color="green" />
      <MetricCard title="실패" value={전환.분해.실패} unit="건" color="red" />
      <MetricCard title="중복문의" value={전환.분해.중복문의} unit="건" color="gray" />
      <MetricCard title="B2B" value={전환.분해.B2B} unit="건" color="gray" />
      <MetricCard title="미확정 (진행중)" value={전환.분해.미확정} unit="건" color="yellow" />
    </div>
  );
}

function AssigneeTable({ rows }: { rows: AssigneeMetric[] }) {
  if (!rows || rows.length === 0) {
    return <p className="text-sm text-gray-400">오늘 응대 기록 없음</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b">
            <th className="py-2 pr-4 font-semibold">담당자</th>
            <th className="py-2 px-4 font-semibold text-right">응대</th>
            <th className="py-2 px-4 font-semibold text-right">결제</th>
            <th className="py-2 pl-4 font-semibold text-right">전환율</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.담당자} className="border-b border-gray-100">
              <td className="py-2 pr-4 font-medium">{r.담당자}</td>
              <td className="py-2 px-4 text-right">{r.응대}</td>
              <td className="py-2 px-4 text-right">{r.결제}</td>
              <td className="py-2 pl-4 text-right font-semibold">{r.전환율_pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

export default function DashboardV2() {
  const [data, setData] = useState<DashboardV2Data | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(''); // '' = 최신
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (date: string) => {
    try {
      const url = date ? `/api/metrics-v2?date=${date}` : '/api/metrics-v2';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DashboardV2Data;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터 조회 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  // 저장된 날짜 목록은 최초 1회만 로드
  useEffect(() => {
    fetch('/api/metrics-v2?type=dates')
      .then((res) => (res.ok ? res.json() : []))
      .then((list: string[]) => setDates(Array.isArray(list) ? list : []))
      .catch(() => setDates([]));
  }, []);

  // KV는 하루 1번(cron)만 갱신 — 선택 날짜가 바뀔 때만 읽는다
  useEffect(() => {
    setLoading(true);
    fetchData(selectedDate);
  }, [fetchData, selectedDate]);

  const 갱신 = data?._meta?.updatedAt
    ? new Date(data._meta.updatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    : '';

  const 헤더 = (
    <header className="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h1 className="text-lg font-bold">SKB+인바운드 통합 대시보드</h1>
        {data && (
          <p className="text-xs text-gray-400">
            집계 {data.집계시작} 이후 · 응대/전환은 {data.오늘} 기준 · 갱신 {갱신}
          </p>
        )}
      </div>
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
    </header>
  );

  if (loading || error || !data) {
    return (
      <div className="max-w-[900px] mx-auto px-4 py-6 space-y-5">
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

  return (
    <div className="max-w-[900px] mx-auto px-4 py-6 space-y-5">
      {헤더}

      <Section title="인바운드">
        <ConversionBlock 전환={data.인바운드.전환} />
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">담당자별 (오늘 응대)</h3>
          <AssigneeTable rows={data.인바운드.담당자별} />
        </div>
        <MetricCard title="오늘 유입" value={data.인바운드.유입건수} unit="건" color="blue" />
        <ChannelChart data={data.인바운드.채널_Top} />
      </Section>

      <Section title="SKB">
        <ConversionBlock 전환={data.skb.전환} />
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">담당자별 (오늘 응대)</h3>
          <AssigneeTable rows={data.skb.담당자별} />
        </div>
        <MetricCard title="오늘 유입" value={data.skb.유입건수} unit="건" color="blue" />
      </Section>

      <Section title="레드텔레콤">
        <div className="grid grid-cols-2 gap-3">
          <MetricCard title="전체" value={data.레드텔레콤.건수_전체} unit="건" color="gray" />
          <MetricCard title="오늘 이후 유입" value={data.레드텔레콤.건수_오늘이후} unit="건" color="blue" />
        </div>
      </Section>

      <div className="text-center text-[10px] text-gray-300 pb-4">
        한화비전 키퍼 · SKB+인바운드 통합관리
      </div>
    </div>
  );
}

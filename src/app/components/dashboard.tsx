'use client';

import { useState, useEffect, useRef } from 'react';
import { MetricsResult, TrendEntry } from '@/lib/types';
import LeadStatusCard from './lead-status-card';
import ActionStatusCard from './action-status-card';
import KPIGauges from './kpi-gauges';
import LeadTimeChart from './lead-time-chart';
import ChannelChart from './channel-chart';
import HourlyChart from './hourly-chart';
import TrendChart from './trend-chart';
import NavTabs from './nav-tabs';
import { ChevronDown } from 'lucide-react';

export default function Dashboard() {
  const [metrics, setMetrics] = useState<MetricsResult | null>(null);
  const [trend, setTrend] = useState<TrendEntry[] | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const dateRef = useRef<HTMLDivElement>(null);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) {
        setDateOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchDates = async () => {
    try {
      const res = await fetch('/api/metrics?type=dates');
      const json = await res.json();
      if (json.dates) setAvailableDates(json.dates);
    } catch {}
  };

  const fetchData = async (date?: string | null) => {
    setLoading(true);
    try {
      const dailyUrl = date ? `/api/metrics?date=${date}` : '/api/metrics';
      const [dailyRes, trendRes] = await Promise.all([
        fetch(dailyUrl),
        fetch('/api/metrics?type=trend'),
      ]);
      const dailyJson = await dailyRes.json();
      const trendJson = await trendRes.json();

      if (dailyJson.data) {
        setMetrics(dailyJson.data);
        setMeta(dailyJson.meta || null);
      }
      if (trendJson.data) {
        setTrend(trendJson.data);
      }
      setError(null);
    } catch (e) {
      setError('데이터를 불러올 수 없습니다');
    }
    setLoading(false);
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setDateOpen(false);
    fetchData(date);
  };

  const handleLatest = () => {
    setSelectedDate(null);
    setDateOpen(false);
    fetchData(null);
  };

  useEffect(() => {
    fetchDates();
    fetchData();
    // 5분마다 자동 새로고침 (최신 보기 중일 때만)
    const interval = setInterval(() => {
      if (!selectedDate) fetchData();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 text-lg">로딩 중...</div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-gray-400 text-lg">{error || '데이터가 없습니다'}</div>
        <div className="text-sm text-gray-300">GitHub Actions로 데이터를 갱신해주세요</div>
        <button
          onClick={() => fetchData(selectedDate)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm"
        >
          다시 시도
        </button>
      </div>
    );
  }

  const lastUpdated = meta?.lastUpdated
    ? new Date(meta.lastUpdated).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    : metrics._meta?.updatedAt
    ? new Date(metrics._meta.updatedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    : '';

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">키퍼 인바운드 대시보드</h1>
          <div className="text-xs text-gray-400 mt-0.5">
            {metrics.대상기간.start === metrics.대상기간.end
              ? metrics.대상기간.start
              : `${metrics.대상기간.start} ~ ${metrics.대상기간.end}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 날짜 선택 드롭다운 */}
          <div className="relative" ref={dateRef}>
            <button
              onClick={() => setDateOpen(!dateOpen)}
              className="flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              {selectedDate || '오늘'}
              <ChevronDown className="w-3 h-3" />
            </button>
            {dateOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                <button
                  onClick={handleLatest}
                  className={`w-full text-left text-xs px-3 py-2 hover:bg-gray-50 ${!selectedDate ? 'bg-blue-50 text-blue-600 font-medium' : ''}`}
                >
                  오늘 (최신)
                </button>
                <div className="border-t border-gray-100" />
                {availableDates.map(d => (
                  <button
                    key={d}
                    onClick={() => handleDateSelect(d)}
                    className={`w-full text-left text-xs px-3 py-2 hover:bg-gray-50 ${selectedDate === d ? 'bg-blue-50 text-blue-600 font-medium' : ''}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>
          <NavTabs />
          <button
            onClick={() => fetchData(selectedDate)}
            className="text-xs px-3 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            새로고침
          </button>
        </div>
      </div>
      {lastUpdated && (
        <div className="text-[10px] text-gray-300 text-right -mt-4">갱신: {lastUpdated}</div>
      )}

      <LeadStatusCard data={metrics.리드} />
      <ActionStatusCard data={metrics.액션} />
      <KPIGauges data={metrics.지표} />
      <LeadTimeChart data={metrics.리드타임} newCount={metrics.리드.오늘신규} />
      <ChannelChart data={metrics.채널_신규Top} />
      <HourlyChart
        유입={metrics.시간대별_유입}
        성공={metrics.시간대별_성공}
        실패={metrics.시간대별_실패}
      />
      {trend && <TrendChart data={trend} />}

      <div className="text-center text-[10px] text-gray-300 pb-4">
        영업일 기준: 전날 20:00 ~ 당일 20:00 KST
      </div>
    </div>
  );
}

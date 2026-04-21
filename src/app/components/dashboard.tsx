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

/** ISO 주차 키(2026-W16)를 "4월 3주차" 형태로 변환 */
function formatWeekLabel(weekKey: string): string {
  // weekKey = "2026-W16" → year=2026, weekNum=16
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekKey;
  const year = parseInt(match[1]);
  const weekNum = parseInt(match[2]);

  // ISO week의 월요일 날짜 계산
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const monday = new Date(firstMonday);
  monday.setUTCDate(firstMonday.getUTCDate() + (weekNum - 1) * 7);

  const month = monday.getUTCMonth() + 1; // 1~12
  // 해당 월의 첫 번째 월요일 기준으로 몇 주차인지 계산
  const firstOfMonth = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), 1));
  const firstOfMonthDay = firstOfMonth.getUTCDay() || 7;
  const firstMondayOfMonth = new Date(firstOfMonth);
  if (firstOfMonthDay <= 1) {
    // 1일이 월요일
  } else {
    firstMondayOfMonth.setUTCDate(firstOfMonth.getUTCDate() + (8 - firstOfMonthDay));
  }
  const weekOfMonth = Math.ceil((monday.getUTCDate() - firstMondayOfMonth.getUTCDate()) / 7) + 1;

  return `${month}월 ${weekOfMonth}주차`;
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<MetricsResult | null>(null);
  const [trend, setTrend] = useState<TrendEntry[] | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
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

  const fetchWeeks = async () => {
    try {
      const res = await fetch('/api/metrics?type=weeks');
      const json = await res.json();
      if (json.weeks) setAvailableWeeks(json.weeks);
    } catch {}
  };

  const fetchData = async (mode: 'daily' | 'weekly', key?: string | null) => {
    setLoading(true);
    try {
      let dataUrl: string;
      if (mode === 'weekly') {
        dataUrl = key ? `/api/metrics?type=weekly&week=${key}` : '/api/metrics?type=weekly';
      } else {
        dataUrl = key ? `/api/metrics?date=${key}` : '/api/metrics';
      }

      const [dataRes, trendRes] = await Promise.all([
        fetch(dataUrl),
        fetch('/api/metrics?type=trend'),
      ]);
      const dataJson = await dataRes.json();
      const trendJson = await trendRes.json();

      if (dataJson.data) {
        setMetrics(dataJson.data);
        setMeta(dataJson.meta || null);
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
    fetchData('daily', date);
  };

  const handleWeekSelect = (week: string) => {
    setSelectedWeek(week);
    setDateOpen(false);
    fetchData('weekly', week);
  };

  const handleLatest = () => {
    if (viewMode === 'daily') {
      setSelectedDate(null);
    } else {
      setSelectedWeek(null);
    }
    setDateOpen(false);
    fetchData(viewMode, null);
  };

  const switchMode = (mode: 'daily' | 'weekly') => {
    setViewMode(mode);
    setDateOpen(false);
    if (mode === 'daily') {
      setSelectedWeek(null);
      fetchData('daily', selectedDate);
    } else {
      setSelectedDate(null);
      fetchData('weekly', selectedWeek);
    }
  };

  useEffect(() => {
    fetchDates();
    fetchWeeks();
    fetchData('daily');
    const interval = setInterval(() => {
      if (viewMode === 'daily' && !selectedDate) fetchData('daily');
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
          onClick={() => fetchData(viewMode, viewMode === 'daily' ? selectedDate : selectedWeek)}
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
            {viewMode === 'weekly' && selectedWeek
              ? (() => {
                  const m = selectedWeek.match(/^(\d{4})-W(\d{2})$/);
                  if (!m) return selectedWeek;
                  const year = parseInt(m[1]);
                  const wn = parseInt(m[2]);
                  const jan4 = new Date(Date.UTC(year, 0, 4));
                  const jan4d = jan4.getUTCDay() || 7;
                  const fm = new Date(jan4);
                  fm.setUTCDate(jan4.getUTCDate() - jan4d + 1);
                  const mon = new Date(fm);
                  mon.setUTCDate(fm.getUTCDate() + (wn - 1) * 7);
                  const sun = new Date(mon);
                  sun.setUTCDate(mon.getUTCDate() + 6);
                  const fmt = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
                  return `${fmt(mon)} ~ ${fmt(sun)}`;
                })()
              : metrics.대상기간.start === metrics.대상기간.end
                ? metrics.대상기간.start
                : `${metrics.대상기간.start} ~ ${metrics.대상기간.end}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 일별/주별 토글 */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => switchMode('daily')}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors ${viewMode === 'daily' ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}
            >
              일별
            </button>
            <button
              onClick={() => switchMode('weekly')}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors ${viewMode === 'weekly' ? 'bg-white shadow-sm font-medium' : 'text-gray-500'}`}
            >
              주별
            </button>
          </div>
          {/* 날짜/주차 선택 드롭다운 */}
          <div className="relative" ref={dateRef}>
            <button
              onClick={() => setDateOpen(!dateOpen)}
              className="flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              {viewMode === 'daily'
                ? (selectedDate || '오늘')
                : (selectedWeek ? formatWeekLabel(selectedWeek) : '이번 주')}
              <ChevronDown className="w-3 h-3" />
            </button>
            {dateOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                <button
                  onClick={handleLatest}
                  className={`w-full text-left text-xs px-3 py-2 hover:bg-gray-50 ${
                    viewMode === 'daily' ? (!selectedDate ? 'bg-blue-50 text-blue-600 font-medium' : '')
                    : (!selectedWeek ? 'bg-blue-50 text-blue-600 font-medium' : '')
                  }`}
                >
                  {viewMode === 'daily' ? '오늘 (최신)' : '이번 주 (최신)'}
                </button>
                <div className="border-t border-gray-100" />
                {viewMode === 'daily'
                  ? availableDates.map(d => (
                      <button
                        key={d}
                        onClick={() => handleDateSelect(d)}
                        className={`w-full text-left text-xs px-3 py-2 hover:bg-gray-50 ${selectedDate === d ? 'bg-blue-50 text-blue-600 font-medium' : ''}`}
                      >
                        {d}
                      </button>
                    ))
                  : availableWeeks.map(w => (
                      <button
                        key={w}
                        onClick={() => handleWeekSelect(w)}
                        className={`w-full text-left text-xs px-3 py-2 hover:bg-gray-50 ${selectedWeek === w ? 'bg-blue-50 text-blue-600 font-medium' : ''}`}
                      >
                        {formatWeekLabel(w)}
                      </button>
                    ))
                }
              </div>
            )}
          </div>
          <NavTabs />
          <button
            onClick={() => fetchData(viewMode, viewMode === 'daily' ? selectedDate : selectedWeek)}
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

'use client';

import { useState, useEffect } from 'react';
import { ChannelBreakdownEntry, AssigneeBreakdownEntry } from '@/lib/types';
import BreakdownBarChart from './breakdown-bar-chart';
import HourlyHeatmap from './hourly-heatmap';

type Tab = 'channel' | 'assignee' | 'hourly';
type Period = 'daily' | 'weekly' | 'monthly';

const TAB_LABELS: Record<Tab, string> = {
  channel: '채널',
  assignee: '담당자',
  hourly: '시간대',
};

const PERIOD_LABELS: Record<Period, string> = {
  daily: '일',
  weekly: '주',
  monthly: '월',
};

const DAYS_BY_PERIOD: Record<Period, number[]> = {
  daily: [7, 14, 30, 60, 90],
  weekly: [4, 8, 13, 26],
  monthly: [3, 6, 12, 24],
};

const DEFAULT_DAYS_BY_PERIOD: Record<Period, number> = {
  daily: 14,
  weekly: 8,
  monthly: 6,
};

interface BreakdownTrendResponse {
  dates: string[];
  data: Record<string, ChannelBreakdownEntry[] | AssigneeBreakdownEntry[] | null>;
}

interface Props {
  /** 상단 모드(일별/주별/월별). 인사이트 카드의 단위가 상단에 종속된다. */
  viewMode: Period;
}

export default function InsightsCard({ viewMode }: Props) {
  const [tab, setTab] = useState<Tab>('channel');
  const period: Period = viewMode; // 상단 모드에 종속
  // period별로 사용자가 선택한 days를 각각 기억 (period 전환 시 자동 복원)
  const [daysByPeriod, setDaysByPeriod] = useState<Record<Period, number>>(DEFAULT_DAYS_BY_PERIOD);
  const days = daysByPeriod[period];
  const setDays = (d: number) => setDaysByPeriod(prev => ({ ...prev, [period]: d }));
  const [trend, setTrend] = useState<BreakdownTrendResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // 채널/담당자 탭일 때만 fetch
  useEffect(() => {
    if (tab === 'hourly') return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const url = `/api/metrics?type=${tab === 'channel' ? 'channel-trend' : 'assignee-trend'}&period=${period}&days=${days}`;
        const res = await fetch(url);
        const json = await res.json();
        if (!cancelled) setTrend(json);
      } catch {
        // 무시
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [tab, period, days]);

  const daysOptions = DAYS_BY_PERIOD[period];
  const periodLabel = PERIOD_LABELS[period];

  return (
    <div className="bg-white rounded-xl border p-4">
      {/* 탭 헤더 */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex gap-1">
          {(['channel', 'assignee', 'hourly'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                tab === t
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
        {tab !== 'hourly' && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400 mr-1">최근</span>
            {daysOptions.map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-2 py-0.5 text-xs rounded ${
                  days === d
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {d}{periodLabel}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 콘텐츠 */}
      <div>
        {tab === 'hourly' ? (
          <HourlyHeatmap />
        ) : loading ? (
          <div className="text-xs text-gray-400 py-8 text-center">불러오는 중…</div>
        ) : trend ? (
          <BreakdownBarChart mode={tab === 'channel' ? 'channel' : 'assignee'} trend={trend} />
        ) : (
          <div className="text-xs text-gray-400 py-8 text-center">데이터 없음</div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { ChannelBreakdownEntry, AssigneeBreakdownEntry, PageBreakdownEntry } from '@/lib/types';
import BreakdownBarChart from './breakdown-bar-chart';
import HourlyHeatmap from './hourly-heatmap';

type Tab = 'channel' | 'page' | 'assignee' | 'hourly';
type Period = 'daily' | 'weekly' | 'monthly';

const TAB_LABELS: Record<Tab, string> = {
  channel: '채널',
  page: '페이지',
  assignee: '담당자',
  hourly: '시간대',
};

interface BreakdownTrendResponse {
  dates: string[];
  data: Record<string, ChannelBreakdownEntry[] | AssigneeBreakdownEntry[] | PageBreakdownEntry[] | null>;
}

interface Props {
  /** 상단 모드(일별/주별/월별). 인사이트 카드의 데이터가 이 모드/일자에 종속된다. */
  viewMode: Period;
  /** 상단에서 선택된 일자 키. daily=YYYY-MM-DD, weekly=YYYY-Www, monthly=YYYY-MM, null=최신. */
  selectedKey: string | null;
  /** 현재 표시 기간 라벨 (예: "2026-05-13" 또는 "2026-05-05 ~ 2026-05-11" 또는 "2026-05"). */
  periodLabel?: string;
}

export default function InsightsCard({ viewMode, selectedKey, periodLabel }: Props) {
  const [tab, setTab] = useState<Tab>('channel');
  const period: Period = viewMode;
  const [trend, setTrend] = useState<BreakdownTrendResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // 상단 모드/일자가 바뀌면 그에 맞춰 자동 fetch
  // - daily: selectedKey=YYYY-MM-DD → 그 날 1일치만 (period=daily&date=YYYY-MM-DD&days=1)
  // - weekly: selectedKey=YYYY-Www → 그 주 7일치 → daily 키 7개 합산
  // - monthly: selectedKey=YYYY-MM → 그 달 daily 키 전체 합산
  useEffect(() => {
    if (tab === 'hourly') return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('type', tab === 'channel' ? 'channel-trend' : tab === 'page' ? 'page-trend' : 'assignee-trend');
        if (period === 'monthly') {
          params.set('period', 'monthly');
          params.set('days', '1');
        } else {
          // daily/weekly 모두 일간 KV 키로 처리. 일자 범위는 selectedKey로 결정.
          params.set('period', 'daily');
          if (period === 'daily') {
            params.set('days', '1');
            if (selectedKey) params.set('date', selectedKey);
          } else {
            // weekly: 7일치
            params.set('days', '7');
            if (selectedKey) params.set('week', selectedKey);
          }
        }
        const res = await fetch(`/api/metrics?${params.toString()}`);
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
  }, [tab, period, selectedKey]);

  return (
    <div className="bg-white rounded-xl border p-4">
      {/* 탭 헤더 */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex gap-1">
          {(['channel', 'page', 'assignee', 'hourly'] as Tab[]).map(t => (
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
        {tab !== 'hourly' && periodLabel && (
          <div className="text-xs text-gray-500">
            기준: <span className="font-medium text-gray-700">{periodLabel}</span>
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
          <BreakdownBarChart
            mode={tab === 'channel' ? 'channel' : tab === 'page' ? 'page' : 'assignee'}
            trend={trend}
          />
        ) : (
          <div className="text-xs text-gray-400 py-8 text-center">데이터 없음</div>
        )}
      </div>
    </div>
  );
}

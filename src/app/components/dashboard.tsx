'use client';

import { useState, useEffect } from 'react';
import { MetricsResult, TrendEntry } from '@/lib/types';
import LeadStatusCard from './lead-status-card';
import ActionStatusCard from './action-status-card';
import KPIGauges from './kpi-gauges';
import LeadTimeChart from './lead-time-chart';
import ChannelChart from './channel-chart';
import HourlyChart from './hourly-chart';
import TrendChart from './trend-chart';

export default function Dashboard() {
  const [metrics, setMetrics] = useState<MetricsResult | null>(null);
  const [trend, setTrend] = useState<TrendEntry[] | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dailyRes, trendRes] = await Promise.all([
        fetch('/api/metrics'),
        fetch('/api/metrics?type=trend'),
      ]);
      const dailyJson = await dailyRes.json();
      const trendJson = await trendRes.json();

      if (dailyJson.data) {
        setMetrics(dailyJson.data);
        setMeta(dailyJson.meta);
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

  useEffect(() => {
    fetchData();
    // 5분마다 자동 새로고침
    const interval = setInterval(fetchData, 5 * 60 * 1000);
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
          onClick={fetchData}
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
        <div className="text-right">
          <button
            onClick={fetchData}
            className="text-xs px-3 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            새로고침
          </button>
          {lastUpdated && (
            <div className="text-[10px] text-gray-300 mt-1">갱신: {lastUpdated}</div>
          )}
        </div>
      </div>

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

'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChannelBreakdownEntry, AssigneeBreakdownEntry } from '@/lib/types';

type BreakdownEntry = ChannelBreakdownEntry | AssigneeBreakdownEntry;

interface BreakdownTrendResponse {
  dates: string[];
  data: Record<string, BreakdownEntry[] | null>;
}

type Period = 'daily' | 'weekly' | 'monthly';

interface Props {
  mode: 'channel' | 'assignee';
  trend: BreakdownTrendResponse;
  topN?: number;
  days?: number;
  onDaysChange?: (days: number) => void;
  period?: Period;
  onPeriodChange?: (period: Period) => void;
}

const DAYS_OPTIONS_BY_PERIOD: Record<Period, number[]> = {
  daily: [14, 30, 60, 90],
  weekly: [4, 8, 13, 26],
  monthly: [3, 6, 12, 24],
};
const PERIOD_LABELS: Record<Period, string> = {
  daily: '일',
  weekly: '주',
  monthly: '월',
};

// 라인 색상 팔레트 (Tailwind-friendly)
const COLORS = [
  '#8b5cf6', // purple
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
];

function getKey(entry: BreakdownEntry, mode: 'channel' | 'assignee'): string {
  return mode === 'channel'
    ? (entry as ChannelBreakdownEntry).채널
    : (entry as AssigneeBreakdownEntry).담당자;
}

export default function BreakdownTrendChart({
  mode,
  trend,
  topN = 6,
  days,
  onDaysChange,
  period = 'daily',
  onPeriodChange,
}: Props) {
  const daysOptions = DAYS_OPTIONS_BY_PERIOD[period];
  const periodLabel = PERIOD_LABELS[period];
  if (!trend?.dates || trend.dates.length === 0) return null;

  // 1) 모든 날짜에서 등장한 채널/담당자별 누적 가용 합계 계산 → 상위 N개 선정
  const totalAvailable = new Map<string, number>();
  for (const date of trend.dates) {
    const entries = trend.data[date];
    if (!Array.isArray(entries)) continue;
    for (const e of entries) {
      const key = getKey(e, mode);
      if (!key) continue;
      totalAvailable.set(key, (totalAvailable.get(key) ?? 0) + (e.가용 ?? 0));
    }
  }
  const topKeys = Array.from(totalAvailable.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([k]) => k);

  if (topKeys.length === 0) return null;

  // 2) 차트 데이터 구성: 날짜별로 각 key의 전환율(%)을 컬럼으로 펼침
  const chartData = trend.dates.map(date => {
    // 월간(YYYY-MM)은 그대로, 그 외엔 MM-DD로 축약
    const label = period === 'monthly' ? date : date.slice(5);
    const row: Record<string, string | number> = { 날짜: label };
    const entries = trend.data[date];
    if (!Array.isArray(entries)) return row;
    for (const key of topKeys) {
      const e = entries.find(ent => getKey(ent, mode) === key);
      if (!e || e.가용 === 0) {
        row[key] = 0;
        continue;
      }
      // 전환율 = 성공(잔존성공 + 신규성공) / 가용(전날잔존 + 오늘신규)
      const success = (e.잔존성공 ?? 0) + (e.신규성공 ?? 0);
      row[key] = Math.round((success / e.가용) * 10000) / 100;
    }
    return row;
  });

  const title = mode === 'channel' ? '채널별 전환율 추이' : '담당자별 전환율 추이';
  const colorClass = mode === 'channel' ? 'text-purple-600' : 'text-blue-600';

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className={`text-sm font-semibold ${colorClass}`}>{title} ({trend.dates.length}{periodLabel})</h2>
        <div className="flex gap-2 items-center">
          {onPeriodChange && (
            <div className="flex gap-1">
              {(['daily', 'weekly', 'monthly'] as Period[]).map(p => (
                <button
                  key={p}
                  onClick={() => onPeriodChange(p)}
                  className={`px-2 py-0.5 text-xs rounded ${
                    period === p
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          )}
          {onDaysChange && (
            <div className="flex gap-1">
              {daysOptions.map(d => (
                <button
                  key={d}
                  onClick={() => onDaysChange(d)}
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
      </div>
      <div className="bg-white rounded-xl border p-4">
        <div className="text-xs text-gray-500 mb-1">상위 {topKeys.length}개 ({mode === 'channel' ? '가용 리드 합계' : '담당자별 가용'} 기준) · 단위 %</div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData}>
            <XAxis dataKey="날짜" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} width={35} unit="%" />
            <Tooltip formatter={(v) => (typeof v === 'number' ? `${v}%` : String(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {topKeys.map((key, idx) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[idx % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 2 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

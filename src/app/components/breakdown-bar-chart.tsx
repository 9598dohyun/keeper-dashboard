'use client';

import { useMemo } from 'react';
import { ChannelBreakdownEntry, AssigneeBreakdownEntry, PageBreakdownEntry } from '@/lib/types';

type BreakdownEntry = ChannelBreakdownEntry | AssigneeBreakdownEntry | PageBreakdownEntry;
type BreakdownMode = 'channel' | 'assignee' | 'page';

interface BreakdownTrendResponse {
  dates: string[];
  data: Record<string, BreakdownEntry[] | null>;
}

interface Props {
  mode: BreakdownMode;
  trend: BreakdownTrendResponse;
  topN?: number;
}

function getKey(entry: BreakdownEntry, mode: BreakdownMode): string {
  if (mode === 'channel') return (entry as ChannelBreakdownEntry).채널;
  if (mode === 'assignee') return (entry as AssigneeBreakdownEntry).담당자;
  return (entry as PageBreakdownEntry).페이지;
}

// 막대 색상 (결제율 구간별)
function barColor(convRate: number): string {
  if (convRate >= 5) return 'bg-green-500';
  if (convRate >= 3) return 'bg-emerald-400';
  if (convRate >= 1) return 'bg-blue-400';
  return 'bg-gray-300';
}

export default function BreakdownBarChart({ mode, trend, topN = 10 }: Props) {
  const rows = useMemo(() => {
    if (!trend?.dates?.length) return [];

    // 기간 합산: 모든 일자/주/월의 같은 키를 누적
    const agg = new Map<string, { 가용: number; 성공: number; 컨택: number; 부재: number; 실패: number }>();
    for (const date of trend.dates) {
      const entries = trend.data[date];
      if (!Array.isArray(entries)) continue;
      for (const e of entries) {
        const key = getKey(e, mode);
        if (!key) continue;
        const cur = agg.get(key) ?? { 가용: 0, 성공: 0, 컨택: 0, 부재: 0, 실패: 0 };
        cur.가용 += e.가용 ?? 0;
        cur.성공 += (e.잔존성공 ?? 0) + (e.신규성공 ?? 0);
        cur.컨택 += e.컨택 ?? 0;
        cur.부재 += e.부재 ?? 0;
        cur.실패 += e.실패 ?? 0;
        agg.set(key, cur);
      }
    }

    return Array.from(agg.entries())
      .map(([key, v]) => ({
        key,
        ...v,
        전환율: v.가용 > 0 ? Math.round((v.성공 / v.가용) * 10000) / 100 : 0,
      }))
      .filter(r => r.가용 > 0)
      .sort((a, b) => b.가용 - a.가용)
      .slice(0, topN);
  }, [trend, mode, topN]);

  if (rows.length === 0) {
    return <div className="text-sm text-gray-500 py-8 text-center">데이터 없음</div>;
  }

  const maxAvailable = Math.max(...rows.map(r => r.가용));

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">
        상위 {rows.length}개 · 신규+잔존 리드 합계 기준 · {trend.dates.length}개 구간 합산
      </div>
      <div className="space-y-1.5">
        {rows.map(r => {
          const width = Math.max(8, (r.가용 / maxAvailable) * 100); // 최소 8% (라벨 보임)
          const color = barColor(r.전환율);
          return (
            <div key={r.key} className="flex items-center gap-2 text-xs">
              <div className="w-28 truncate text-right text-gray-700 font-medium" title={r.key}>
                {r.key}
              </div>
              <div className="flex-1 bg-gray-100 rounded h-6 relative overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 ${color} flex items-center justify-between px-2 text-white font-semibold transition-all`}
                  style={{ width: `${width}%` }}
                >
                  <span className="tabular-nums">{r.전환율}%</span>
                  <span className="tabular-nums opacity-90">결제 {r.성공} · 응대 {r.컨택} · 전체 {r.가용}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-gray-400 pt-1 flex gap-3 flex-wrap">
        <span>막대 길이: 신규+잔존 리드</span>
        <span>막대 안: 결제율 % · 결제 / 응대 / 전체 건수</span>
        <span>색: ≥5% 진녹 · ≥3% 녹 · ≥1% 파랑 · &lt;1% 회색</span>
      </div>
    </div>
  );
}

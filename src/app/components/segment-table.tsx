'use client';

import type { SegmentRow } from '@/lib/metrics3/types';
import { isUnknownKey } from '@/lib/metrics3/source';

interface Props {
  rows: SegmentRow[];
  /** 첫 컬럼 헤더 (예: 시간대 / 매체 / 담당자) */
  keyLabel: string;
  /** 유입 건수가 이 값 미만인 행은 숨김 (표본 부족 행 노이즈 제거) */
  minVolume?: number;
  /** 방치·평균경과일 컬럼 표시 여부 */
  showStale?: boolean;
  /** 상위 N개만 표시 (교차 표처럼 행이 많을 때) */
  limit?: number;
}

/** 전환율에 따른 색상 — 10% 미만은 경고 */
function rateColor(pct: number): string {
  if (pct >= 15) return 'text-green-700';
  if (pct >= 10) return 'text-gray-800';
  return 'text-red-600';
}

export default function SegmentTable({
  rows,
  keyLabel,
  minVolume = 0,
  showStale = true,
  limit,
}: Props) {
  const passed = rows.filter((r) => r.유입 >= minVolume);
  const visible = limit ? passed.slice(0, limit) : passed;
  const hidden = rows.length - passed.length;
  const truncated = passed.length - visible.length;
  const 미확인건 = rows
    .filter((r) => isUnknownKey(r.key))
    .reduce((s, r) => s + r.유입, 0);

  if (visible.length === 0) {
    return <p className="text-sm text-gray-400">데이터 없음</p>;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 pr-3 font-semibold">{keyLabel}</th>
              <th className="py-2 px-3 font-semibold text-right">유입</th>
              <th className="py-2 px-3 font-semibold text-right">결제</th>
              <th className="py-2 px-3 font-semibold text-right">유입대비</th>
              <th className="py-2 px-3 font-semibold text-right">종결대비</th>
              <th className="py-2 px-3 font-semibold text-right">미확정률</th>
              {showStale && (
                <>
                  <th className="py-2 px-3 font-semibold text-right">15일+ 방치</th>
                  <th className="py-2 pl-3 font-semibold text-right">평균경과</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const unknown = isUnknownKey(r.key);
              return (
              <tr
                key={r.key}
                className={`border-b border-gray-100 ${unknown ? 'bg-gray-50/70' : ''}`}
              >
                <td className="py-2 pr-3 font-medium">
                  <span className={unknown ? 'text-gray-500' : ''}>{r.key}</span>
                </td>
                <td className="py-2 px-3 text-right tabular-nums">{r.유입.toLocaleString()}</td>
                <td className="py-2 px-3 text-right tabular-nums">{r.결제.toLocaleString()}</td>
                <td
                  className={`py-2 px-3 text-right tabular-nums font-semibold ${rateColor(
                    r.유입대비_pct
                  )}`}
                >
                  {r.유입대비_pct}%
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-gray-600">
                  {r.종결대비_pct}%
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-gray-600">
                  {r.미확정률_pct}%
                </td>
                {showStale && (
                  <>
                    <td
                      className={`py-2 px-3 text-right tabular-nums font-semibold ${
                        r.방치_15일 > 0 ? 'text-red-600' : 'text-gray-400'
                      }`}
                    >
                      {r.방치_15일.toLocaleString()}
                    </td>
                    <td className="py-2 pl-3 text-right tabular-nums text-gray-600">
                      {r.평균경과일}일
                    </td>
                  </>
                )}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 space-y-0.5">
        {truncated > 0 && (
          <p className="text-xs text-gray-400">상위 {visible.length}개 표시 · {truncated}개 더 있음</p>
        )}
        {hidden > 0 && (
          <p className="text-xs text-gray-400">
            유입 {minVolume}건 미만 {hidden}개 항목은 표본 부족으로 숨김
          </p>
        )}
        {미확인건 > 0 && (
          <p className="text-xs text-gray-400">
            (미확인) {미확인건.toLocaleString()}건은 유입 출처가 기록되지 않은 건으로,
            대표전화·지인추천 등 추적이 붙지 않는 경로가 섞여 있어 다른 항목과 직접 비교할 수 없음
          </p>
        )}
      </div>
    </div>
  );
}

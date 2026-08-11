'use client';

import { useMemo, useState } from 'react';
import type { StaleBucketStat, StaleLead, StaleBucket } from '@/lib/metrics3/types';

interface Props {
  버킷: StaleBucketStat[];
  리드: StaleLead[];
  제외건수: number;
}

const MAX_ROWS = 100;

/**
 * 방치 리드 — 이 대시보드의 핵심 화면.
 * 버킷을 누르면 해당 구간 리드 목록이 열리고, CSV로 내려받아 재컨택 리스트로 쓸 수 있다.
 */
export default function StaleLeads({ 버킷, 리드, 제외건수 }: Props) {
  const [selected, setSelected] = useState<StaleBucket | null>(null);

  const 총건 = 버킷.reduce((s, b) => s + b.건수, 0);
  const 조치대상 = 버킷.filter((b) => b.조치대상).reduce((s, b) => s + b.건수, 0);
  const max = Math.max(...버킷.map((b) => b.건수), 1);

  const rows = useMemo(
    () => (selected ? 리드.filter((l) => l.버킷 === selected) : []),
    [리드, selected]
  );

  function downloadCsv() {
    const target = selected ? rows : 리드;
    const header = ['레코드ID', '유입일', '경과일', '구간', '시간대', '매체', '유입페이지', '담당자', '부재중상태', '온도감'];
    const body = target.map((l) =>
      [l.id, l.유입일, l.경과일, l.버킷, l.시간대, l.매체, l.유입페이지, l.담당자, l.부재중상태, l.온도감].join(',')
    );
    // Excel에서 한글이 깨지지 않도록 BOM 추가
    const blob = new Blob(['﻿' + [header.join(','), ...body].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `방치리드_${selected ?? '전체'}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="text-sm text-gray-600">
          미확정 <span className="font-bold text-gray-900">{총건.toLocaleString()}</span>건 중
          15일 이상 경과{' '}
          <span className="font-bold text-red-600">{조치대상.toLocaleString()}</span>건
        </p>
        {제외건수 > 0 && (
          <p className="text-xs text-gray-400">
            중복·연락금지 {제외건수}건은 제외
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        {버킷.map((b) => {
          const active = selected === b.버킷;
          return (
            <button
              key={b.버킷}
              onClick={() => setSelected(active ? null : b.버킷)}
              className={`w-full flex items-center gap-3 text-left group ${
                active ? 'opacity-100' : 'opacity-90 hover:opacity-100'
              }`}
            >
              <span className="w-16 shrink-0 text-xs font-medium text-gray-600">{b.버킷}</span>
              <span className="flex-1 h-6 bg-gray-100 rounded overflow-hidden relative">
                <span
                  className={`block h-full rounded transition-all ${
                    b.조치대상 ? 'bg-red-500' : 'bg-blue-400'
                  } ${active ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                  style={{ width: `${(b.건수 / max) * 100}%` }}
                />
              </span>
              <span
                className={`w-20 shrink-0 text-right text-sm font-semibold tabular-nums ${
                  b.조치대상 ? 'text-red-600' : 'text-gray-700'
                }`}
              >
                {b.건수.toLocaleString()}건
              </span>
              {b.조치대상 && (
                <span className="shrink-0 text-[10px] font-bold text-red-600 border border-red-300 rounded px-1 py-0.5">
                  조치 필요
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={downloadCsv}
          className="text-xs font-semibold border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50"
        >
          CSV 내려받기 ({selected ? `${selected} ${rows.length}건` : `전체 ${리드.length}건`})
        </button>
        {selected && (
          <button
            onClick={() => setSelected(null)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            선택 해제
          </button>
        )}
      </div>

      {selected && (
        <div className="border-t pt-3">
          <p className="text-xs text-gray-500 mb-2">
            {selected} 구간 {rows.length.toLocaleString()}건
            {rows.length > MAX_ROWS && ` (상위 ${MAX_ROWS}건 표시 — 전체는 CSV로 확인)`}
            {' · 경과일 내림차순'}
          </p>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-1.5 pr-3 font-semibold">유입일</th>
                  <th className="py-1.5 px-3 font-semibold text-right">경과</th>
                  <th className="py-1.5 px-3 font-semibold">시간대</th>
                  <th className="py-1.5 px-3 font-semibold">매체</th>
                  <th className="py-1.5 px-3 font-semibold">유입페이지</th>
                  <th className="py-1.5 px-3 font-semibold">담당자</th>
                  <th className="py-1.5 px-3 font-semibold">부재중</th>
                  <th className="py-1.5 pl-3 font-semibold">온도감</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, MAX_ROWS).map((l) => (
                  <tr key={l.id} className="border-b border-gray-50">
                    <td className="py-1.5 pr-3 tabular-nums">{l.유입일}</td>
                    <td className="py-1.5 px-3 text-right tabular-nums font-semibold text-red-600">
                      {l.경과일}일
                    </td>
                    <td className="py-1.5 px-3 text-gray-600">{l.시간대}</td>
                    <td className="py-1.5 px-3 text-gray-600">{l.매체}</td>
                    <td className="py-1.5 px-3 text-gray-600">{l.유입페이지}</td>
                    <td className="py-1.5 px-3 text-gray-600">{l.담당자}</td>
                    <td className="py-1.5 px-3 text-gray-600">{l.부재중상태}</td>
                    <td className="py-1.5 pl-3 text-gray-600">{l.온도감}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

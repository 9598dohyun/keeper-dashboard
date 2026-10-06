'use client';

import { useEffect, useState } from 'react';
import type { ChannelPayResult } from '@/lib/kpi/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Props {
  /** 조회 단위. 생략하면 기존처럼 최신 월 */
  kind?: 'week' | 'month' | 'day';
  /** kind별 식별자 — week: YYYY-Www, month: YYYY-MM, day: YYYY-MM-DD. 생략하면 최신 */
  period?: string | null;
}

const KIND_LABEL: Record<NonNullable<Props['kind']>, string> = {
  week: '이번 주',
  month: '이번 달',
  day: '이 날',
};

/**
 * 채널별 결제 (엑셀 원장 기준).
 *
 * 위쪽 채널 차트는 `UTM_source` 기준 **유입** 분포라 축이 다르다. 여기는 엑셀
 * `주문유입채널` 기준 **결제**이고, 에어테이블에 리드가 없는 채널(오가닉·키퍼맨·
 * B2B 영업 등)까지 센다 — 대시보드 결제수에는 안 잡히는 물량이다.
 *
 * 조회 단위(주차별·월별·날짜별)는 대시보드가 보고 있는 탭·기간에 맞춰 부모가 넘긴다 —
 * 고정으로 "이번 달"만 보여주면 다른 탭에서 화면과 안 맞는 값이 뜬다.
 */
export default function ChannelPayCard({ kind, period }: Props) {
  const [data, setData] = useState<ChannelPayResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams({ type: 'channel' });
    if (kind && period) params.set(kind, period);
    fetch(`/api/kpi?${params.toString()}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!alive) return;
        if (!ok || d?.error) {
          setData(null);
          setNotFound(true);
        } else {
          setData(d);
          setNotFound(false);
        }
      })
      .catch(() => alive && setNotFound(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [kind, period]);

  const 제목 = kind ? KIND_LABEL[kind] : '이번 달';

  if (loading) return null;

  if (notFound || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">채널별 결제 ({제목})</CardTitle>
          <CardDescription>
            이 기간의 채널별 결제 데이터가 아직 집계되지 않았습니다 — compute-kpi.ts가
            이 날짜로 실행돼야 채워진다(월 KPI 갱신 단계, SKILL.md 6단계 중 마지막).
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data.행.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">채널별 결제 ({제목})</CardTitle>
          <CardDescription>
            {data.기간.시작} ~ {data.기간.종료} · 이 기간엔 결제 데이터 엑셀 기준 결제가 0건이다.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">채널별 결제 ({제목})</CardTitle>
        <CardDescription>
          결제 데이터 엑셀의 주문유입채널 기준 · {data.기간.시작} ~ {data.기간.종료} · 총{' '}
          {data.총결제}건. 위 채널 차트는 유입 분포라 세는 대상이 다르다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>채널</TableHead>
              <TableHead className="text-right">건수</TableHead>
              <TableHead className="text-right">비중</TableHead>
              <TableHead className="text-right">리드 매칭</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.행.map((r) => (
              <TableRow key={r.채널}>
                <TableCell className="font-medium">{r.채널}</TableCell>
                <TableCell className="text-right tabular-nums">{r.결제}건</TableCell>
                <TableCell className="text-right tabular-nums">{r.비중_pct}%</TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.리드있음}건 있음 · {r.리드없음}건 없음
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          리드 없음(총 {data.총리드없음}건)은 에어테이블에 리드가 없어 위 결제수에는 안 잡히는
          건이다(오가닉·키퍼맨·B2B 영업 등). 월 KPI는 채널을 가리지 않고 전량을 세므로 이 건들도
          포함한다.
        </p>
      </CardContent>
    </Card>
  );
}

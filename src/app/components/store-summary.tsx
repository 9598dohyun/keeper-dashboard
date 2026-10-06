'use client';

import { useEffect, useState } from 'react';
import type { StoreSummary } from '@/lib/metrics2/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/** 큰 숫자 하나 — 다른 카드와 같은 톤 */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

/**
 * 누적결제 탭 — 매장(주소) 단위 전체 누적.
 *
 * 결제 데이터 엑셀(키퍼_주문정산통합데이터)로 누적한다. 같은 주소면 매장 1곳으로 묶고
 * (여러 번 결제해도 1건), 주소가 공란이면 매장명으로 대체 구분한다. 취소 건은 빼고
 * 설치완료·설치일시확정·설치접수 등 유효 결제만 센다 — 에어테이블 리드 매칭과 무관하게
 * 엑셀 전량(채널 불문)을 집계한다.
 *
 * scripts/payment-sync/reconcile.py가 결제 엑셀을 받을 때마다 data/매장별누적.json에
 * 쌓고, compute-and-push.ts가 KV(store:summary)로 올린다.
 */
export default function StoreSummaryView() {
  const [data, setData] = useState<StoreSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch('/api/store-summary')
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => null);
          throw new Error(d?.error ?? `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((d: StoreSummary) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : '조회 실패'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          누적 결제 데이터를 불러오지 못했습니다. {error ?? ''}
        </AlertDescription>
      </Alert>
    );
  }

  const 갱신 = new Date(data.갱신시각).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">누적결제 현황</CardTitle>
          <CardDescription>
            결제 데이터 엑셀 전량 누적(취소 제외) · 매장은 설치주소 기준 중복 제거(주소 공란은
            매장명으로 구분) · 갱신 {갱신}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-2">
          <Stat label="매장 수" value={`${data.매장수_전체.toLocaleString('ko-KR')}곳`} />
          <Stat label="누적 결제건수" value={`${data.결제건수_전체.toLocaleString('ko-KR')}건`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">지역별 누적 (설치주소 기준)</CardTitle>
          <CardDescription>
            8도(광역단위) 기준 · 결제건수 많은 순 · 주소로 지역을 알 수 없는 건은 &quot;기타/미상&quot;
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>지역</TableHead>
                <TableHead className="text-right">매장 수</TableHead>
                <TableHead className="text-right">누적 결제건수</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/50">
                <TableCell className="font-semibold">전체</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {data.매장수_전체}곳
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {data.결제건수_전체}건
                </TableCell>
              </TableRow>
              {data.지역별.map((r) => (
                <TableRow key={r.지역}>
                  <TableCell className="font-medium">{r.지역}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.매장수}곳</TableCell>
                  <TableCell className="text-right tabular-nums">{r.결제건수}건</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

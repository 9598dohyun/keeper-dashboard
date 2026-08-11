import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { DashboardV2 } from '@/lib/metrics2/types';
import { buildTrend } from '@/lib/metrics2/trend';

/**
 * SKB+인바운드 통합 대시보드(v2) 데이터.
 * GET /api/metrics-v2                  → v2:latest 전체 (최신 = 오늘)
 * GET /api/metrics-v2?type=meta        → v2:meta
 * GET /api/metrics-v2?type=dates       → 저장된 날짜 목록 (내림차순)
 * GET /api/metrics-v2?type=trend&days=30 → 날짜별 추이 (그날 값, 누적 아님)
 * GET /api/metrics-v2?date=YYYY-MM-DD  → 해당 날짜 스냅샷
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const date = searchParams.get('date');

  try {
    if (type === 'meta') {
      const meta = await kv.get('v2:meta');
      return NextResponse.json(meta ?? {});
    }

    if (type === 'trend') {
      // 날짜별 추이 — 저장된 일간 스냅샷을 모아 하루 단위 시계열로 변환
      const dates = (await kv.get<string[]>('v2:dates')) ?? [];
      const limit = Number(searchParams.get('days') ?? 30);
      const target = dates.slice(0, Math.max(1, Math.min(limit, 90)));
      const snapshots = await Promise.all(
        target.map((d) => kv.get<DashboardV2>(`v2:daily:${d}`))
      );
      return NextResponse.json(buildTrend(snapshots.filter((s): s is DashboardV2 => !!s)));
    }

    if (type === 'dates') {
      const dates = await kv.get<string[]>('v2:dates');
      return NextResponse.json(dates ?? []);
    }

    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: '날짜 형식 오류' }, { status: 400 });
      }
      const snapshot = await kv.get<DashboardV2>(`v2:daily:${date}`);
      if (!snapshot) {
        return NextResponse.json(
          { error: '해당 날짜 데이터가 없습니다.' },
          { status: 404 }
        );
      }
      return NextResponse.json(snapshot);
    }

    const data = await kv.get<DashboardV2>('v2:latest');
    if (!data) {
      return NextResponse.json(
        { error: '데이터가 아직 생성되지 않았습니다.' },
        { status: 404 }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('metrics-v2 error:', error);
    return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 });
  }
}

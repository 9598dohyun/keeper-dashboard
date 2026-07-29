import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { DashboardV2 } from '@/lib/metrics2/types';

/**
 * SKB+인바운드 통합 대시보드(v2) 데이터.
 * GET /api/metrics-v2           → v2:latest 전체
 * GET /api/metrics-v2?type=meta → v2:meta
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  try {
    if (type === 'meta') {
      const meta = await kv.get('v2:meta');
      return NextResponse.json(meta ?? {});
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

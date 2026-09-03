import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { KpiMonth } from '@/lib/kpi/types';

/**
 * 월 KPI 목표 대비 달성.
 * GET /api/kpi                 → 최신 월
 * GET /api/kpi?month=2026-09   → 그 달
 * GET /api/kpi?type=months     → KPI가 있는 월 목록
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const month = searchParams.get('month');

  try {
    if (type === 'months') {
      return NextResponse.json((await kv.get<string[]>('kpi:months')) ?? []);
    }

    let 월 = month;
    if (!월) {
      const months = (await kv.get<string[]>('kpi:months')) ?? [];
      월 = months[0];
      if (!월) return NextResponse.json({ error: 'KPI 데이터가 없습니다.' }, { status: 404 });
    }
    if (!/^\d{4}-\d{2}$/.test(월)) {
      return NextResponse.json({ error: '월 형식 오류 (YYYY-MM)' }, { status: 400 });
    }

    const data = await kv.get<KpiMonth>(`kpi:month:${월}`);
    if (!data) {
      return NextResponse.json({ error: `${월} KPI 데이터가 없습니다.` }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('kpi error:', error);
    return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 });
  }
}

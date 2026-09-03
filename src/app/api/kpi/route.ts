import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { KpiMonth, ChannelPayResult, LagResult, BurndownPoint } from '@/lib/kpi/types';

/**
 * 월 KPI 목표 대비 달성.
 * GET /api/kpi                 → 최신 월
 * GET /api/kpi?month=2026-09   → 그 달
 * GET /api/kpi?type=months     → KPI가 있는 월 목록
 * GET /api/kpi?type=channel     → 채널별 결제 (엑셀 기준, 리드 없는 채널 포함)
 * GET /api/kpi?type=lag         → 유입→결제 소요일 분포 (전 기간)
 * GET /api/kpi?type=burndown    → 목표 대비 누적 추이
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const month = searchParams.get('month');

  try {
    if (type === 'months') {
      return NextResponse.json((await kv.get<string[]>('kpi:months')) ?? []);
    }

    if (type === 'lag') {
      const lag = await kv.get<LagResult>('kpi:lag');
      if (!lag) return NextResponse.json({ error: '소요일 데이터가 없습니다.' }, { status: 404 });
      return NextResponse.json(lag);
    }

    if (type === 'burndown') {
      let 월 = month;
      if (!월) 월 = ((await kv.get<string[]>('kpi:months')) ?? [])[0];
      if (!월 || !/^\d{4}-\d{2}$/.test(월)) {
        return NextResponse.json({ error: '월 형식 오류 (YYYY-MM)' }, { status: 400 });
      }
      const b = await kv.get<BurndownPoint[]>(`kpi:burndown:${월}`);
      if (!b) return NextResponse.json({ error: `${월} 추이 데이터가 없습니다.` }, { status: 404 });
      return NextResponse.json(b);
    }

    if (type === 'channel') {
      let 월 = month;
      if (!월) {
        const months = (await kv.get<string[]>('kpi:months')) ?? [];
        월 = months[0];
      }
      if (!월 || !/^\d{4}-\d{2}$/.test(월)) {
        return NextResponse.json({ error: '월 형식 오류 (YYYY-MM)' }, { status: 400 });
      }
      const ch = await kv.get<ChannelPayResult>(`kpi:channel:${월}`);
      if (!ch) {
        return NextResponse.json({ error: `${월} 채널 데이터가 없습니다.` }, { status: 404 });
      }
      return NextResponse.json(ch);
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

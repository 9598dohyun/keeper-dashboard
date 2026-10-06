import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { StoreSummary } from '@/lib/metrics2/types';

/**
 * 누적결제 탭 — 매장(주소) 단위 누적 결제 요약.
 * GET /api/store-summary → store:summary (compute-and-push.ts가 reconcile.py 결과를 저장)
 */
export async function GET() {
  const data = await kv.get<StoreSummary>('store:summary');
  if (!data) {
    return NextResponse.json({ error: '누적 결제 데이터가 아직 없습니다.' }, { status: 404 });
  }
  return NextResponse.json(data);
}

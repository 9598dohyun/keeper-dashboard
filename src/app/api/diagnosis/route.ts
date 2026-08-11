import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { DiagnosisResult } from '@/lib/metrics3/types';
import { D3_RANGES } from '@/lib/constants';

/**
 * 전환율 진단 대시보드 데이터.
 * GET /api/diagnosis                          → 최신 (기본 90일)
 * GET /api/diagnosis?range=30                 → 최신, 30일 기간
 * GET /api/diagnosis?type=dates               → 스냅샷 보유 날짜 목록 (내림차순)
 * GET /api/diagnosis?type=meta                → 갱신 시각·집계 시작일
 * GET /api/diagnosis?date=YYYY-MM-DD&range=60 → 그날 마감 시점 스냅샷
 *
 * metrics2(/api/metrics-v2)와 분모가 다른 별개 지표다. 혼용 금지.
 */
const ALLOWED = D3_RANGES.map(String);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const date = searchParams.get('date');
  const range = searchParams.get('range') ?? '90';

  try {
    if (type === 'dates') {
      const dates = await kv.get<string[]>('d3:dates');
      return NextResponse.json(dates ?? []);
    }

    if (type === 'meta') {
      const meta = await kv.get('d3:meta');
      return NextResponse.json(meta ?? {});
    }

    if (!ALLOWED.includes(range)) {
      return NextResponse.json(
        { error: `range는 ${ALLOWED.join(', ')} 중 하나여야 합니다.` },
        { status: 400 }
      );
    }

    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: '날짜 형식 오류' }, { status: 400 });
      }
      const snapshot = await kv.get<DiagnosisResult>(`d3:daily:${date}:${range}`);
      if (!snapshot) {
        return NextResponse.json(
          { error: '해당 날짜 스냅샷이 없습니다.' },
          { status: 404 }
        );
      }
      return NextResponse.json(snapshot);
    }

    const data = await kv.get<DiagnosisResult>(`d3:range:${range}`);
    if (!data) {
      return NextResponse.json(
        { error: '데이터가 아직 생성되지 않았습니다.' },
        { status: 404 }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('diagnosis error:', error);
    return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 });
  }
}

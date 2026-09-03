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
 * GET /api/diagnosis?kind=week                → 고를 수 있는 주차 목록
 * GET /api/diagnosis?kind=week&period=2026-W35 → 그 주(월~일) 지표
 * GET /api/diagnosis?type=comment&date=YYYY-MM-DD → 그날 진단 코멘트 (인바운드+SKB)
 *
 * metrics2(/api/metrics-v2)와 분모가 다른 별개 지표다. 혼용 금지.
 */
const ALLOWED = D3_RANGES.map(String);
const KINDS = ['day', 'week', 'month'] as const;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const date = searchParams.get('date');
  const range = searchParams.get('range') ?? '90';

  try {
    // 일간·주별·월별 — 경계가 고정된 기간
    const kind = searchParams.get('kind');
    if (kind) {
      if (!KINDS.includes(kind as (typeof KINDS)[number])) {
        return NextResponse.json(
          { error: `kind는 ${KINDS.join(', ')} 중 하나여야 합니다.` },
          { status: 400 }
        );
      }
      const period = searchParams.get('period');
      if (!period) {
        const list = await kv.get(`d3:periods:${kind}`);
        return NextResponse.json(list ?? []);
      }
      if (!/^[0-9]{4}-(W[0-9]{2}|[0-9]{2}|[0-9]{2}-[0-9]{2})$/.test(period)) {
        return NextResponse.json({ error: '기간 형식 오류' }, { status: 400 });
      }
      const snap = await kv.get<DiagnosisResult>(`d3:period:${kind}:${period}`);
      if (!snap) {
        return NextResponse.json({ error: '해당 기간 데이터가 없습니다.' }, { status: 404 });
      }
      return NextResponse.json(snap);
    }

    // 일자별 코멘트 — 그날 응대·결제 실적 축. 없으면 빈 객체를 준다(화면에서 감춤)
    if (type === 'comment') {
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: '날짜 형식 오류' }, { status: 400 });
      }
      const [인바운드, skb] = await Promise.all([
        kv.get(`d3:comment:${date}:인바운드`),
        kv.get(`d3:comment:${date}:skb`),
      ]);
      return NextResponse.json({ 인바운드: 인바운드 ?? null, skb: skb ?? null });
    }

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

import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { DashboardV2 } from '@/lib/metrics2/types';
import { buildTrend } from '@/lib/metrics2/trend';
import { MEMO_TS_START } from '@/lib/metrics2/compute';
import {
  summarizePeriod,
  summarizeRedtel,
  periodRange,
  listSelectablePeriods,
  PeriodKind,
  TableKey,
} from '@/lib/metrics2/period';

const PERIOD_KINDS = ['week', 'month'] as const;
const TABLE_KEYS: TableKey[] = ['인바운드', 'skb', '정보와기술'];

/**
 * SKB+인바운드 통합 대시보드(v2) 데이터.
 * GET /api/metrics-v2                  → v2:latest 전체 (최신 = 오늘)
 * GET /api/metrics-v2?type=meta        → v2:meta
 * GET /api/metrics-v2?type=dates       → 저장된 날짜 목록 (내림차순)
 * GET /api/metrics-v2?type=trend&days=30 → 날짜별 추이 (그날 값, 누적 아님)
 * GET /api/metrics-v2?type=period-list&kind=week|month
 *   → 선택 가능한 주차/월 목록 (최신순, {kind,id,label,시작,종료})
 * GET /api/metrics-v2?type=period&kind=week|month&period=<id 생략시 오늘이 속한 기간>&table=인바운드|skb|정보와기술|레드텔레콤
 *   → 기간 합산 요약(응대·결제·담당자별·재컨택·채널). table=레드텔레콤은 별도 모양(RedtelPeriodSummary)
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

    if (type === 'period-list') {
      const kind = searchParams.get('kind') as PeriodKind | null;
      if (!kind || !PERIOD_KINDS.includes(kind)) {
        return NextResponse.json({ error: 'kind 파라미터 오류 (week|month)' }, { status: 400 });
      }
      // 응대·전환 지표는 MEMO_TS_START(메모수정시각 기준 전환일) 이전엔 신뢰할 수 없어
      // 날짜별 드롭다운도 이 날짜부터다 — 주차별·월별 드롭다운도 같은 하한을 쓴다.
      return NextResponse.json(listSelectablePeriods(kind, MEMO_TS_START));
    }

    if (type === 'period') {
      const kind = searchParams.get('kind') as PeriodKind | null;
      const period = searchParams.get('period');
      const table = searchParams.get('table') as TableKey | '레드텔레콤' | null;
      if (!kind || !PERIOD_KINDS.includes(kind)) {
        return NextResponse.json({ error: 'kind 파라미터 오류 (week|month)' }, { status: 400 });
      }
      if (!table || ![...TABLE_KEYS, '레드텔레콤'].includes(table)) {
        return NextResponse.json(
          { error: 'table 파라미터 오류 (인바운드|skb|정보와기술|레드텔레콤)' },
          { status: 400 }
        );
      }
      const { 시작, 끝 } = periodRange(kind, period, MEMO_TS_START);
      const dates = ((await kv.get<string[]>('v2:dates')) ?? []).filter(
        (d) => d >= 시작 && d <= 끝
      );
      const snapshots = await Promise.all(
        dates.map((d) => kv.get<DashboardV2>(`v2:daily:${d}`))
      );
      const valid = snapshots.filter((s): s is DashboardV2 => !!s);
      if (table === '레드텔레콤') {
        return NextResponse.json(summarizeRedtel(valid, 시작, 끝));
      }
      return NextResponse.json(summarizePeriod(valid, table, 시작, 끝));
    }

    if (type === 'trend') {
      // 날짜별 추이 — 저장된 일간 스냅샷을 모아 하루 단위 시계열로 변환
      // 기준 전환일 이전 스냅샷은 Last Modified 기준이라 섞으면 오독되므로 제외
      const dates = ((await kv.get<string[]>('v2:dates')) ?? []).filter(
        (d) => d >= MEMO_TS_START
      );
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

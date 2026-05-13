import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const type = searchParams.get('type') || 'daily';

  try {
    // 사용 가능한 날짜 목록 반환
    if (type === 'dates') {
      const keys: string[] = await kv.keys('metrics:daily:*');
      const dates = keys
        .map(k => k.replace('metrics:daily:', ''))
        .filter(d => d !== 'latest' && /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort()
        .reverse();
      return NextResponse.json({ dates });
    }

    // 사용 가능한 주차 목록 반환
    if (type === 'weeks') {
      const keys: string[] = await kv.keys('metrics:weekly:*');
      const weeks = keys
        .map(k => k.replace('metrics:weekly:', ''))
        .filter(w => w !== 'latest' && /^\d{4}-W\d{2}$/.test(w))
        .sort()
        .reverse();
      return NextResponse.json({ weeks });
    }

    // 주간 데이터 조회
    if (type === 'weekly') {
      const week = searchParams.get('week');
      if (week) {
        const data = await kv.get(`metrics:weekly:${week}`);
        if (!data) {
          return NextResponse.json({ error: 'No data for this week' }, { status: 404 });
        }
        return NextResponse.json({ data, type: 'weekly' });
      }
      const data = await kv.get('metrics:weekly:latest');
      const meta = await kv.get('metrics:meta');
      return NextResponse.json({ data, meta, type: 'weekly' });
    }

    if (type === 'trend') {
      const trend = await kv.get('metrics:trend:14d');
      return NextResponse.json({ data: trend, type: 'trend' });
    }

    // 시간대별 히트맵: 최근 N일치 일간 데이터를 요일×시간으로 집계
    // 응답: { rows: [{ day: 0|1|...|6, hours: [count, count, ...] }], days, metric: '유입'|'성공'|'실패' }
    if (type === 'hourly-heatmap') {
      const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '14', 10) || 14, 1), 90);
      const metric = (searchParams.get('metric') ?? '유입') as '유입' | '성공' | '실패';
      const metricKey = metric === '유입' ? '시간대별_유입' : metric === '성공' ? '시간대별_성공' : '시간대별_실패';

      const allKeys: string[] = await kv.keys('metrics:daily:*');
      const dailyDates = allKeys
        .map(k => k.replace('metrics:daily:', ''))
        .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort()
        .slice(-days);

      if (dailyDates.length === 0) {
        return NextResponse.json({ rows: [], days, metric, total: 0 });
      }

      type DailyEntry = { 시간대별_유입?: Record<number, number>; 시간대별_성공?: Record<number, number>; 시간대별_실패?: Record<number, number> };
      const values = await Promise.all(
        dailyDates.map(d => kv.get<DailyEntry>(`metrics:daily:${d}`))
      );

      // 7요일 × 24시간 행렬 초기화
      const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
      let total = 0;
      dailyDates.forEach((dateStr, i) => {
        const v = values[i];
        if (!v) return;
        const d = new Date(dateStr + 'T12:00:00+09:00');
        const dow = d.getDay(); // 0=일, 1=월, ..., 6=토
        const buckets = v[metricKey] ?? {};
        for (const [hourStr, count] of Object.entries(buckets)) {
          const hour = parseInt(hourStr, 10);
          if (!isNaN(hour) && hour >= 0 && hour < 24) {
            matrix[dow][hour] += (count as number) ?? 0;
            total += (count as number) ?? 0;
          }
        }
      });

      const rows = matrix.map((hours, day) => ({ day, hours }));
      return NextResponse.json({ rows, days, metric, total, dates: dailyDates });
    }

    // 채널별 일간 breakdown (Python push_to_sheets.py가 저장)
    if (type === 'channel-daily') {
      const targetDate = date ?? (await kv.get<string>('metrics:meta') ? (await kv.get<{ dataDate?: string }>('metrics:meta'))?.dataDate : null);
      if (!targetDate) {
        return NextResponse.json({ error: 'date required' }, { status: 400 });
      }
      const data = await kv.get(`metrics:channel:daily:${targetDate}`);
      return NextResponse.json({ data, type: 'channel-daily', date: targetDate });
    }

    // 담당자별 일간 breakdown
    if (type === 'assignee-daily') {
      const targetDate = date ?? (await kv.get<string>('metrics:meta') ? (await kv.get<{ dataDate?: string }>('metrics:meta'))?.dataDate : null);
      if (!targetDate) {
        return NextResponse.json({ error: 'date required' }, { status: 400 });
      }
      const data = await kv.get(`metrics:assignee:daily:${targetDate}`);
      return NextResponse.json({ data, type: 'assignee-daily', date: targetDate });
    }

    // 채널/담당자별 추이: 최근 N개 기간의 breakdown을 한 번에 반환
    // period=daily(기본) → 일자 키 (YYYY-MM-DD)
    // period=weekly → 주 종료일 키 (YYYY-MM-DD, 월요일)
    // period=monthly → 월 키 (YYYY-MM)
    if (type === 'channel-trend' || type === 'assignee-trend') {
      const period = (searchParams.get('period') ?? 'daily') as 'daily' | 'weekly' | 'monthly';
      const defaultDays = period === 'monthly' ? 6 : period === 'weekly' ? 8 : 14;
      const maxDays = period === 'monthly' ? 24 : period === 'weekly' ? 26 : 90;
      const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? String(defaultDays), 10) || defaultDays, 1), maxDays);
      const resource = type === 'channel-trend' ? 'channel' : 'assignee';
      const keyPrefix = `metrics:${resource}:${period}`;
      const keyPattern = period === 'monthly' ? /^\d{4}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/;

      const allKeys: string[] = await kv.keys(`${keyPrefix}:*`);
      const dates = allKeys
        .map(k => k.replace(`${keyPrefix}:`, ''))
        .filter(d => keyPattern.test(d))
        .sort()
        .slice(-days);

      if (dates.length === 0) {
        return NextResponse.json({ dates: [], data: {}, type, period, days });
      }

      const values = await Promise.all(
        dates.map(d => kv.get(`${keyPrefix}:${d}`))
      );
      const dataByDate: Record<string, unknown> = {};
      dates.forEach((d, i) => {
        dataByDate[d] = values[i];
      });

      return NextResponse.json({ dates, data: dataByDate, type, period, days });
    }

    if (date) {
      const data = await kv.get(`metrics:daily:${date}`);
      if (!data) {
        return NextResponse.json({ error: 'No data for this date' }, { status: 404 });
      }
      return NextResponse.json({ data, type: 'daily' });
    }

    // 기본: 최신 데이터
    const data = await kv.get('metrics:daily:latest');
    const meta = await kv.get('metrics:meta');
    return NextResponse.json({ data, meta, type: 'daily' });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}

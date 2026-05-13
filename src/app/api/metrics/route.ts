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

    // 채널별 추이: 최근 N일치 일별 breakdown을 한 번에 반환
    // 응답 형식: { dates: [...], data: { [date]: ChannelBreakdownEntry[] } }
    if (type === 'channel-trend' || type === 'assignee-trend') {
      const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '14', 10) || 14, 1), 90);
      const keyPrefix = type === 'channel-trend' ? 'metrics:channel:daily' : 'metrics:assignee:daily';

      // KV에 저장된 모든 일자 키를 가져와서 최근 days개만 선택
      const allKeys: string[] = await kv.keys(`${keyPrefix}:*`);
      const dates = allKeys
        .map(k => k.replace(`${keyPrefix}:`, ''))
        .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort()
        .slice(-days);

      if (dates.length === 0) {
        return NextResponse.json({ dates: [], data: {}, type });
      }

      const values = await Promise.all(
        dates.map(d => kv.get(`${keyPrefix}:${d}`))
      );
      const dataByDate: Record<string, unknown> = {};
      dates.forEach((d, i) => {
        dataByDate[d] = values[i];
      });

      return NextResponse.json({ dates, data: dataByDate, type, days });
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

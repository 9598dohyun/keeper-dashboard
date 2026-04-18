import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const type = searchParams.get('type') || 'daily';

  try {
    if (type === 'trend') {
      const trend = await kv.get('metrics:trend:14d');
      return NextResponse.json({ data: trend, type: 'trend' });
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
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}

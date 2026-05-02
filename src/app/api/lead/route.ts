import { NextResponse } from 'next/server';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const LEAD_TABLE_ID = 'tbl45D05oiu3wffTT'; // 피추천인

function isValidPhone(raw: string) {
  const digits = raw.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11;
}

export async function POST(request: Request) {
  if (!AIRTABLE_BASE_ID || !AIRTABLE_TOKEN) {
    return NextResponse.json(
      { error: '서버 설정이 완료되지 않았습니다. 관리자에게 문의해주세요.' },
      { status: 500 }
    );
  }

  let body: { name?: string; phone?: string; source?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const name = (body.name ?? '').trim();
  const phone = (body.phone ?? '').trim();
  const source = body.source === 'trial' ? 'trial' : 'cal';

  if (!name) {
    return NextResponse.json({ error: '이름을 입력해주세요.' }, { status: 400 });
  }
  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: '올바른 전화번호 형식이 아닙니다.' }, { status: 400 });
  }
  if (name.length > 40) {
    return NextResponse.json({ error: '이름이 너무 깁니다.' }, { status: 400 });
  }

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${LEAD_TABLE_ID}`;

  const fields: Record<string, unknown> = {
    피추천인이름: name,
    연락처: phone,
    진입경로: source === 'trial' ? '한달무료체험-trial페이지' : '견적계산기-cal페이지',
    'UTM_source': source === 'trial' ? 'trial-page' : 'cal-page',
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        records: [{ fields }],
        typecast: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[lead] Airtable error', res.status, errText);
      return NextResponse.json(
        { error: '신청 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[lead] fetch failed', err);
    return NextResponse.json(
      { error: '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';

// SK브로드밴드 종료 고객 전용 (/sk_lead 페이지)
// 별도 베이스: SK브로드밴드 통합관리 (appa2Foo0JnvfPmlp)
const SK_BASE_ID = process.env.SK_AIRTABLE_BASE_ID;
const SK_TOKEN = process.env.AIRTABLE_TOKEN; // 한화 통합 토큰 (키퍼+SK 두 베이스 접근)
const SK_TABLE_ID = 'tbl45D05oiu3wffTT'; // 고객

function isValidPhone(raw: string) {
  const digits = raw.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11;
}

export async function POST(request: Request) {
  if (!SK_BASE_ID || !SK_TOKEN) {
    return NextResponse.json(
      { error: '서버 설정이 완료되지 않았습니다. 관리자에게 문의해주세요.' },
      { status: 500 }
    );
  }

  let body: { name?: string; phone?: string; store?: string; agree?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const name = (body.name ?? '').trim();
  const phone = (body.phone ?? '').trim();
  const store = (body.store ?? '').trim();

  if (!name) {
    return NextResponse.json({ error: '성함을 입력해주세요.' }, { status: 400 });
  }
  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: '올바른 전화번호 형식이 아닙니다.' }, { status: 400 });
  }
  if (name.length > 40) {
    return NextResponse.json({ error: '이름이 너무 깁니다.' }, { status: 400 });
  }
  if (store.length > 40) {
    return NextResponse.json({ error: '매장명이 너무 깁니다.' }, { status: 400 });
  }
  if (body.agree !== true) {
    return NextResponse.json({ error: '개인정보 수집·이용에 동의해주세요.' }, { status: 400 });
  }

  const url = `https://api.airtable.com/v0/${SK_BASE_ID}/${SK_TABLE_ID}`;

  const fields: Record<string, unknown> = {
    이름: name,
    연락처: phone,
    'UTM_source': 'sk-lead-page',
    페이지경로: '/sk_lead',
    '개인정보 수집동의': true,
  };
  if (store) {
    fields.매장명 = store;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SK_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        records: [{ fields }],
        typecast: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[sk-lead] Airtable error', res.status, errText);
      return NextResponse.json(
        { error: '신청 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[sk-lead] fetch failed', err);
    return NextResponse.json(
      { error: '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    );
  }
}

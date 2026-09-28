/**
 * 월 KPI 계산 → Vercel KV 저장
 *
 * 결제 원장(엑셀 기준)에서 날짜별 결제 건수를 뽑아 월 목표와 대조한다.
 * 목표는 영업일(주말·법정공휴일 제외)에만 배분한다.
 *
 * 저장 키
 *   kpi:month:{YYYY-MM}   월 KPI (목표·일별 달성)
 *   kpi:target:{YYYY-MM}  월 목표값 (다음 실행에서 재사용 — 매번 안 넣어도 된다)
 *   kpi:months            KPI가 있는 월 목록 (내림차순)
 *
 * 실행
 *   npx tsx scripts/compute-kpi.ts --month 2026-09 --target 630 --date 2026-09-02
 *   npx tsx scripts/compute-kpi.ts --date 2026-09-02        # 목표는 저장된 값 재사용
 */
import fs from 'fs';
import path from 'path';
import { kv } from '@vercel/kv';
import { computeKpi } from '../src/lib/kpi/compute';
import { ChannelPay, ChannelPayResult, BurndownPoint } from '../src/lib/kpi/types';
import { computeLag, LagInput } from '../src/lib/kpi/lag';
import { weekIdOf, resolvePeriod } from '../src/lib/metrics3/period';

/** 'YYYY-MM-DD' → 그 날짜의 로컬(달력) Date. GitHub Actions는 UTC 실행이라 new Date(string) 파싱을 피한다 */
function parseYMDLocal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const DATA_DIR = path.join(__dirname, '../data');

function 인자(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

/** 결제 원장 원본 읽기 */
function 원장(): Record<string, { 결제일?: string | null; 취소?: boolean; 채널?: string; 매칭?: boolean }> {
  const p = path.join(DATA_DIR, '결제원장.json');
  if (!fs.existsSync(p)) throw new Error(`${p} 없음 — reconcile.py를 먼저 실행하세요.`);
  return (JSON.parse(fs.readFileSync(p, 'utf8')).주문 ?? {}) as ReturnType<typeof 원장>;
}

/**
 * 채널별 결제 집계 — 임의의 [시작, 종료] 기간(결제일 기준, 취소 제외).
 *
 * 리드가 없는 채널(오가닉·키퍼맨·B2B 영업 등)도 센다 — 대시보드 결제수는 에어테이블
 * 리드에 매칭된 건만 세므로 이 채널들이 통째로 빠진다. 그 규모를 `리드없음`으로 드러낸다.
 */
function 채널별(시작: string, 종료: string): ChannelPayResult {
  const acc = new Map<string, { 결제: number; 리드있음: number; 리드없음: number }>();
  let 총결제 = 0;
  for (const o of Object.values(원장())) {
    if (o.취소 || !o.결제일) continue;
    if (o.결제일 < 시작 || o.결제일 > 종료) continue;
    const c = o.채널 || '(채널없음)';
    const v = acc.get(c) ?? { 결제: 0, 리드있음: 0, 리드없음: 0 };
    v.결제++;
    if (o.매칭) v.리드있음++;
    else v.리드없음++;
    acc.set(c, v);
    총결제++;
  }
  const 행: ChannelPay[] = [...acc.entries()]
    .map(([채널, v]) => ({
      채널,
      ...v,
      비중_pct: 총결제 > 0 ? Math.round((v.결제 / 총결제) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.결제 - a.결제);
  return {
    기간: { 시작, 종료 },
    총결제,
    총리드없음: 행.reduce((s, r) => s + r.리드없음, 0),
    행,
  };
}

/** 리드ID → 유입일(YYYY-MM-DD). 인바운드·SKB를 한 맵으로 합친다 */
function 유입일맵(): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of ['인바운드', 'SKB']) {
    const p = path.join(DATA_DIR, `${t}.json`);
    if (!fs.existsSync(p)) continue;
    const recs = JSON.parse(fs.readFileSync(p, 'utf8')) as {
      id: string;
      fields: { 유입시간?: string };
    }[];
    for (const r of recs) {
      const s = r.fields?.유입시간;
      if (!s) continue;
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) continue;
      m.set(r.id, new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10));
    }
  }
  return m;
}

/**
 * 유입→결제 소요일 입력 만들기.
 *
 * 원장의 주문마다 붙은 리드 ID로 유입일을 찾는다. 리드가 없는 채널(오가닉·키퍼맨 등)은
 * 유입일을 알 수 없어 제외로 빠진다 — 그 규모는 결과의 `제외`에 담긴다.
 */
function 소요일입력(): LagInput[] {
  const ing = 유입일맵();
  const out: LagInput[] = [];
  for (const o of Object.values(원장())) {
    if (o.취소 || !o.결제일) continue;
    const rec = o as typeof o & { 인바운드ID?: string[]; skbID?: string[] };
    const id = (rec.인바운드ID ?? [])[0] ?? (rec.skbID ?? [])[0];
    out.push({
      유입일: id ? (ing.get(id) ?? null) : null,
      결제일: o.결제일,
      채널: o.채널 || '(채널없음)',
    });
  }
  return out;
}

/** 목표 대비 누적 추이 (번다운) */
function 번다운(k: { 일별: { 날짜: string; 누적목표: number; 누적실적: number | null; 영업일: boolean }[] }): BurndownPoint[] {
  return k.일별.map((d) => ({
    날짜: d.날짜,
    누적목표: d.누적목표,
    누적실적: d.누적실적,
    영업일: d.영업일,
  }));
}

/** 결제 원장 → 날짜별 결제 건수 (채널 무관 전량, 취소 제외) */
function 실적맵(): Record<string, number> {
  const p = path.join(DATA_DIR, '결제원장.json');
  if (!fs.existsSync(p)) throw new Error(`${p} 없음 — reconcile.py를 먼저 실행하세요.`);
  const led = JSON.parse(fs.readFileSync(p, 'utf8')) as {
    주문?: Record<string, { 결제일?: string | null; 취소?: boolean }>;
  };
  const out: Record<string, number> = {};
  for (const o of Object.values(led.주문 ?? {})) {
    if (o.취소 || !o.결제일) continue;
    out[o.결제일] = (out[o.결제일] ?? 0) + 1;
  }
  return out;
}

async function main() {
  const 기준일 = 인자('--date');
  if (!기준일 || !/^\d{4}-\d{2}-\d{2}$/.test(기준일)) {
    throw new Error('--date YYYY-MM-DD 로 기준일을 지정해 주세요.');
  }
  const 월 = 인자('--month') ?? 기준일.slice(0, 7);

  // 목표는 인자로 받거나, 없으면 저장된 값을 쓴다
  const 인자목표 = 인자('--target');
  let 목표: number;
  if (인자목표 !== undefined) {
    목표 = Number(인자목표);
    if (!Number.isFinite(목표) || 목표 <= 0) throw new Error(`--target 값 오류: ${인자목표}`);
    await kv.set(`kpi:target:${월}`, 목표);
  } else {
    const 저장 = await kv.get<number>(`kpi:target:${월}`);
    if (저장 == null) {
      throw new Error(`${월} 목표가 저장돼 있지 않습니다 — 처음엔 --target 을 지정하세요.`);
    }
    목표 = 저장;
  }

  const k = computeKpi(월, 목표, 기준일, 실적맵());
  await kv.set(`kpi:month:${월}`, k);

  // 채널별 결제 — 대시보드에서 리드 없는 채널까지 보이게 한다.
  // 월별(이번 달 1일~기준일) + 기준일이 속한 주(월~일)·기준일 하루도 함께 저장 —
  // 주차별·날짜별 화면에서 '이번 달' 값이 그대로 노출되는 걸 막기 위함.
  const ch = 채널별(`${월}-01`, 기준일);
  await kv.set(`kpi:channel:${월}`, ch);

  const 주 = resolvePeriod('week', weekIdOf(parseYMDLocal(기준일)));
  const chWeek = 채널별(주.시작, 기준일 < 주.종료 ? 기준일 : 주.종료);
  await kv.set(`kpi:channel:week:${주.id}`, chWeek);

  const chDay = 채널별(기준일, 기준일);
  await kv.set(`kpi:channel:day:${기준일}`, chDay);

  // 유입→결제 소요일 (전 기간 원장 기준 — 월로 자르면 표본이 너무 적다)
  const lag = computeLag(소요일입력());
  await kv.set('kpi:lag', lag);

  // 목표 대비 누적 추이
  await kv.set(`kpi:burndown:${월}`, 번다운(k));

  const months = (await kv.get<string[]>('kpi:months')) ?? [];
  if (!months.includes(월)) {
    months.push(월);
    months.sort((a, b) => b.localeCompare(a));
    await kv.set('kpi:months', months);
  }

  console.log(`${월} 목표 ${k.목표} · 영업일 ${k.영업일수}일 · 일목표 ${k.일목표}`);
  console.log(
    `기준일 ${k.기준일} 누적 ${k.누적실적} / 목표 ${k.누적목표} → ` +
      `${k.격차 >= 0 ? '+' : ''}${k.격차} (달성률 ${k.달성률_pct}%)`
  );
  console.log(
    `잔여 ${k.잔여}건 / 남은 영업일 ${k.잔여영업일}일 → 하루 ${k.필요일평균 ?? '—'}건 필요` +
      ` · 현재 속도 예상착지 ${k.예상착지}건`
  );
  console.log(
    `채널별 결제 ${ch.총결제}건 (리드없음 ${ch.총리드없음}건 — 대시보드 결제수엔 안 잡힘):`
  );
  for (const r of ch.행) {
    console.log(
      `  ${r.채널.padEnd(10)} ${String(r.결제).padStart(3)}건 (${r.비중_pct}%)` +
        (r.리드없음 > 0 ? ` · 리드없음 ${r.리드없음}` : '')
    );
  }

  console.log(
    `소요일 (n=${lag.n}, 제외 ${lag.제외}): 중앙 ${lag.중앙}일 · 당일 ${lag.당일_pct}% · 7일내 ${lag.누적7일_pct}%`
  );
  for (const r of lag.분포) {
    console.log(`  ${r.버킷.padEnd(7)} ${String(r.건수).padStart(3)}건 ${r.비중_pct}% (누적 ${r.누적_pct}%)`);
  }
  for (const c of lag.채널별) {
    console.log(`  [${c.채널}] n=${c.결제} 중앙 ${c.중앙}일 · 당일 ${c.당일_pct}%`);
  }

  const 공휴일 = k.일별.filter((d) => d.공휴일);
  if (공휴일.length) {
    console.log('공휴일: ' + 공휴일.map((d) => `${d.날짜}(${d.공휴일})`).join(', '));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

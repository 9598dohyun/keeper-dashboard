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

const DATA_DIR = path.join(__dirname, '../data');

function 인자(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

/** 결제 원장 → 날짜별 결제 건수 (인바운드 + SKB, 취소 제외) */
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
  const 공휴일 = k.일별.filter((d) => d.공휴일);
  if (공휴일.length) {
    console.log('공휴일: ' + 공휴일.map((d) => `${d.날짜}(${d.공휴일})`).join(', '));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

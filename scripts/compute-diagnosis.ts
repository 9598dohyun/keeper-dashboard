/**
 * 진단 지표 계산 → Vercel KV 저장
 *
 * data/인바운드.json + data/SKB.json 을 읽어 30/60/90일 스냅샷을 만든다.
 * fetch-airtable.ts 실행 후에 돌려야 한다.
 *
 * 저장 키
 *   d3:period:{day|week|month}:{id}    기간별 (일간/주별/월별) — 경계가 고정된 기간
 *   d3:periods:{day|week|month}        고를 수 있는 기간 목록
 *   d3:range:{30|60|90}          최신 (기간별)
 *   d3:latest                    최신 (= 90일)
 *   d3:daily:{YYYY-MM-DD}:{30|60|90}   그날 마감 시점 스냅샷
 *   d3:dates                     스냅샷이 있는 날짜 목록 (내림차순)
 *   d3:meta                      갱신 시각·집계 시작일
 *
 * 하루 1회(KST 23:59) 실행 기준이며, 같은 날 여러 번 돌리면 그날 값이 덮어써진다.
 *
 * 로컬 실행: npx tsx scripts/compute-diagnosis.ts
 */
import fs from 'fs';
import path from 'path';
import { kv } from '@vercel/kv';
import { computeDiagnosis, LEADTIME_START } from '../src/lib/metrics3/compute';
import { D3Record, DiagnosisResult } from '../src/lib/metrics3/types';
import { toKST, formatDate } from '../src/lib/metrics/biz-date';
import { D3_SNAPSHOT_START, D3_RANGES, KV_D3_DAILY_TTL } from '../src/lib/constants';
import { listPeriods, PeriodKind } from '../src/lib/metrics3/period';

const DATA_DIR = path.join(__dirname, '../data');

/**
 * 누적 결제 원장 → 결제로 인정할 레코드 ID.
 *
 * 결제 여부의 진짜 소스는 결제 데이터 엑셀이다(reconcile.py 가 원장에 쌓는다).
 * 원장이 없으면 null 을 돌려 기존대로 에어테이블 최종결과 기준으로 계산된다.
 */
function loadLedgerIds(): {
  inbound: Set<string> | null;
  skb: Set<string> | null;
  orders: number;
  /** 원장이 덮는 가장 이른 결제일. 이 날 이후 유입분만 엑셀로 판정한다 */
  coversSince: string | null;
} {
  const p = path.join(DATA_DIR, '결제원장.json');
  if (!fs.existsSync(p)) return { inbound: null, skb: null, orders: 0, coversSince: null };
  const ledger = JSON.parse(fs.readFileSync(p, 'utf8')) as {
    주문: Record<
      string,
      { 취소?: boolean; 결제일?: string | null; 인바운드ID?: string[]; skbID?: string[] }
    >;
  };
  const inbound = new Set<string>();
  const skb = new Set<string>();
  let earliest: string | null = null;
  for (const rec of Object.values(ledger.주문 ?? {})) {
    if (rec.결제일 && (earliest === null || rec.결제일 < earliest)) earliest = rec.결제일;
    if (rec.취소) continue;
    for (const id of rec.인바운드ID ?? []) inbound.add(id);
    for (const id of rec.skbID ?? []) skb.add(id);
  }
  return {
    inbound,
    skb,
    orders: Object.keys(ledger.주문 ?? {}).length,
    coversSince: earliest,
  };
}
/** 방치 리드 목록 상한 — KV 용량과 화면 렌더 비용을 고려 */
const STALE_LIMIT = 1000;

function readTable(name: string): D3Record[] {
  const p = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(p)) {
    throw new Error(`${p} 없음 — fetch-airtable.ts를 먼저 실행하세요.`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8')) as D3Record[];
}

/** KST 기준 오늘 (로컬 타임존 무관) */
function todayKST(): Date {
  const kst = toKST(new Date());
  return new Date(kst.getFullYear(), kst.getMonth(), kst.getDate());
}

function minusDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - days);
  return x;
}

async function main() {
  const inbound = readTable('인바운드');
  const skb = readTable('SKB');
  const today = todayKST();
  const todayStr = formatDate(today);
  const ledger = loadLedgerIds();
  console.log(
    ledger.inbound
      ? `결제 소스: 엑셀 원장 ${ledger.coversSince}~ (인바운드 ${ledger.inbound.size} · SKB ${ledger.skb!.size}) / 그 이전 유입분은 에어테이블 기준`
      : '결제 소스: 에어테이블 [콜]최종 결과 (결제원장.json 없음)'
  );
  const paidInbound = { ids: ledger.inbound, since: ledger.coversSince };
  const paidSkb = { ids: ledger.skb, since: ledger.coversSince };

  for (const days of D3_RANGES) {
    const since = formatDate(minusDays(today, days));
    const result: DiagnosisResult = {
      집계일: todayStr,
      기간: { 시작: since, 종료: todayStr, 일수: days },
      인바운드: computeDiagnosis(inbound, {
        today,
        since,
        staleLimit: STALE_LIMIT,
        paid: paidInbound,
      }),
      skb: computeDiagnosis(skb, {
        today,
        since,
        staleLimit: STALE_LIMIT,
        paid: paidSkb,
      }),
      meta: {
        updatedAt: new Date().toISOString(),
        리드타임_집계시작: LEADTIME_START,
        스냅샷_시작: D3_SNAPSHOT_START,
        결제소스: ledger.inbound ? 'excel' : 'airtable',
        원장_주문수: ledger.orders,
        원장_시작일: ledger.coversSince,
      },
    };

    await kv.set(`d3:range:${days}`, result);
    // 날짜별 스냅샷 — 과거 어느 날 상태였는지 되짚어볼 수 있게 보관
    await kv.set(`d3:daily:${todayStr}:${days}`, result, { ex: KV_D3_DAILY_TTL });
    if (days === 90) await kv.set('d3:latest', result);

    const i = result.인바운드;
    const 방치 = i.방치버킷.filter((b) => b.조치대상).reduce((s, b) => s + b.건수, 0);
    console.log(
      `[${days}일] 인바운드 유입 ${i.전체.유입} 결제 ${i.전체.결제} (${i.전체.유입대비_pct}%) 방치15+ ${방치} / ` +
        `SKB 유입 ${result.skb.전체.유입} 결제 ${result.skb.전체.결제} (${result.skb.전체.유입대비_pct}%)`
    );
  }

  // 일간·주별·월별 — 경계가 고정된 기간별 스냅샷.
  // "최근 30일"과 달리 같은 주·달을 다시 조회하면 언제 봐도 같은 값이 나온다.
  for (const kind of ['day', 'week', 'month'] as PeriodKind[]) {
    const periods = listPeriods(kind, today, D3_SNAPSHOT_START);
    for (const p of periods) {
      const result: DiagnosisResult = {
        집계일: todayStr,
        기간: { 시작: p.시작, 종료: p.종료, 일수: 0, 종류: kind, id: p.id, 라벨: p.label },
        인바운드: computeDiagnosis(inbound, {
          today,
          since: p.시작,
          until: p.종료,
          staleLimit: STALE_LIMIT,
          paid: paidInbound,
        }),
        skb: computeDiagnosis(skb, {
          today,
          since: p.시작,
          until: p.종료,
          staleLimit: STALE_LIMIT,
          paid: paidSkb,
        }),
        meta: {
          updatedAt: new Date().toISOString(),
          리드타임_집계시작: LEADTIME_START,
          스냅샷_시작: D3_SNAPSHOT_START,
          결제소스: ledger.inbound ? 'excel' : 'airtable',
          원장_주문수: ledger.orders,
          원장_시작일: ledger.coversSince,
        },
      };
      await kv.set(`d3:period:${kind}:${p.id}`, result, { ex: KV_D3_DAILY_TTL });
    }
    await kv.set(
      `d3:periods:${kind}`,
      periods.map((p) => ({ id: p.id, label: p.label, 시작: p.시작, 종료: p.종료 }))
    );
    console.log(`[${kind}] 기간 ${periods.length}개 저장`);
  }

  // 날짜 목록 갱신 (내림차순, 중복 제거)
  const dates = (await kv.get<string[]>('d3:dates')) ?? [];
  if (!dates.includes(todayStr)) {
    dates.push(todayStr);
    dates.sort((a, b) => b.localeCompare(a));
    await kv.set('d3:dates', dates);
  }

  await kv.set('d3:meta', {
    updatedAt: new Date().toISOString(),
    집계일: todayStr,
    스냅샷_시작: D3_SNAPSHOT_START,
    리드타임_집계시작: LEADTIME_START,
    보유날짜수: dates.length,
  });

  console.log(`진단 지표 KV 저장 완료 — 스냅샷 ${todayStr} (보유 ${dates.length}일)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

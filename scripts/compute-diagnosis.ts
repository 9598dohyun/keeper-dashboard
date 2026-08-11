/**
 * 진단 지표 계산 → Vercel KV 저장
 *
 * data/인바운드.json + data/SKB.json 을 읽어 30/60/90일 스냅샷을 만든다.
 * fetch-airtable.ts 실행 후에 돌려야 한다.
 *
 * 저장 키
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

const DATA_DIR = path.join(__dirname, '../data');
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

  for (const days of D3_RANGES) {
    const since = formatDate(minusDays(today, days));
    const result: DiagnosisResult = {
      집계일: todayStr,
      기간: { 시작: since, 종료: todayStr, 일수: days },
      인바운드: computeDiagnosis(inbound, { today, since, staleLimit: STALE_LIMIT }),
      skb: computeDiagnosis(skb, { today, since, staleLimit: STALE_LIMIT }),
      meta: {
        updatedAt: new Date().toISOString(),
        리드타임_집계시작: LEADTIME_START,
        스냅샷_시작: D3_SNAPSHOT_START,
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

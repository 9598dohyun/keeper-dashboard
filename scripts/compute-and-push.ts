/**
 * 로컬 JSON에서 인바운드·SKB·레드텔레콤 데이터를 읽고 v2 지표를 계산하여 Vercel KV에 저장
 * GitHub Actions에서 실행됨
 *
 * 응대·전환: Last Modified가 '오늘'(KST) 기준 / 유입·채널: 유입시간 기준
 */
import fs from 'fs';
import path from 'path';
import { V2Record, DashboardV2 } from '../src/lib/metrics2/types';
import { computeInbound, computeSkb, computeCount } from '../src/lib/metrics2/compute';
import { formatDate, toKST } from '../src/lib/metrics/biz-date';
import { V2_AGGREGATE_START } from '../src/lib/constants';

const DATA_DIR = path.join(__dirname, '../data');
const KV_URL = process.env.KV_REST_API_URL!;
const KV_TOKEN = process.env.KV_REST_API_TOKEN!;

async function kvSet(key: string, value: unknown, exSeconds?: number) {
  const args: Array<string | number> = ['SET', key, JSON.stringify(value)];
  if (exSeconds) args.push('EX', exSeconds);

  const res = await fetch(`${KV_URL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });

  if (!res.ok) {
    throw new Error(`KV SET failed: ${res.status} ${await res.text()}`);
  }
}

/** 오늘 날짜 (KST, YYYY-MM-DD) — compute.ts의 kstDate와 동일 변환 사용 */
function todayKST(): string {
  return formatDate(toKST(new Date()));
}

function load(name: string): V2Record[] {
  const p = path.join(DATA_DIR, name);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as V2Record[];
}

async function main() {
  const 집계시작 = V2_AGGREGATE_START;
  const 오늘 = todayKST();

  const inboundRecords = load('인바운드.json');
  const skbRecords = load('SKB.json');
  const redtelRecords = load('레드텔레콤.json');

  const 인바운드 = computeInbound(inboundRecords, 집계시작, 오늘);
  const skb = computeSkb(skbRecords, 집계시작, 오늘);
  const 레드텔레콤 = computeCount(redtelRecords, 집계시작);

  const updatedAt = new Date().toISOString();
  const dashboard: DashboardV2 = {
    인바운드,
    skb,
    레드텔레콤,
    집계시작,
    오늘,
    _meta: {
      updatedAt,
      counts: {
        인바운드: inboundRecords.length,
        skb: skbRecords.length,
        레드텔레콤: redtelRecords.length,
      },
    },
  };

  await kvSet('v2:latest', dashboard);
  await kvSet('v2:meta', {
    updatedAt,
    집계시작,
    오늘,
    counts: dashboard._meta.counts,
  });

  console.log('v2:latest 저장 완료');
  console.log(`  인바운드: 오늘응대 ${인바운드.전환.응대} / 결제 ${인바운드.전환.결제} / 전환율 ${인바운드.전환.전환율_pct}% / 오늘유입 ${인바운드.유입건수}`);
  console.log(`  SKB: 오늘응대 ${skb.전환.응대} / 결제 ${skb.전환.결제} / 전환율 ${skb.전환.전환율_pct}% / 오늘유입 ${skb.유입건수}`);
  console.log(`  레드텔레콤: 전체 ${레드텔레콤.건수_전체} / 오늘이후 ${레드텔레콤.건수_오늘이후}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * 로컬 JSON에서 데이터를 읽고 지표를 계산하여 Vercel KV에 저장
 * GitHub Actions에서 실행됨
 */
import fs from 'fs';
import path from 'path';
import { AirtableLead, AirtableHistory, TrendEntry } from '../src/lib/types';
import { buildHistByLead, computeRange } from '../src/lib/metrics/index';
import { formatDate } from '../src/lib/metrics/biz-date';

const DATA_DIR = path.join(__dirname, '../data');
const KV_URL = process.env.KV_REST_API_URL!;
const KV_TOKEN = process.env.KV_REST_API_TOKEN!;

async function kvSet(key: string, value: any, exSeconds?: number) {
  const args: any[] = ['SET', key, JSON.stringify(value)];
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

function getDateStr(daysAgo: number): string {
  const d = new Date();
  // KST
  d.setTime(d.getTime() + 9 * 60 * 60 * 1000);
  d.setDate(d.getDate() - daysAgo);
  return formatDate(d);
}

async function main() {
  // Load data
  const leads: AirtableLead[] = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, '피추천인.json'), 'utf-8')
  );
  const histRecords: AirtableHistory[] = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, '이력관리.json'), 'utf-8')
  );
  const histByLead = buildHistByLead(histRecords);

  console.log(`Loaded: ${leads.length} leads, ${histRecords.length} history events`);

  // 오늘 (KST) 지표 계산
  const today = getDateStr(0);
  console.log(`Computing metrics for ${today}...`);
  const todayMetrics = computeRange(today, today, leads, histByLead);

  // KV에 저장
  await kvSet(`metrics:daily:${today}`, todayMetrics, 7 * 86400); // 7일 TTL
  await kvSet('metrics:daily:latest', todayMetrics);
  console.log(`Saved metrics:daily:${today} + latest`);

  // 최근 14일 트렌드 계산
  const trend: TrendEntry[] = [];
  for (let i = 13; i >= 0; i--) {
    const dateStr = getDateStr(i);
    const r = computeRange(dateStr, dateStr, leads, histByLead);
    trend.push({
      date: dateStr,
      전날잔존: r.리드.전날잔존,
      오늘신규_고유: r.리드.오늘신규_고유,
      오늘잔존: r.리드.오늘잔존,
      오늘성공: r.액션.오늘성공,
      오늘실패: r.액션.오늘실패,
      오늘부재: r.액션.오늘부재,
      전환율: r.지표.전환율_pct,
      소진율: r.지표.소진율_pct,
      부재율: r.지표.부재율_pct,
      리드타임_중앙값: r.리드타임.중앙값_분 ?? null,
    });
  }

  await kvSet('metrics:trend:14d', trend, 86400); // 1일 TTL
  console.log(`Saved trend (${trend.length} days)`);

  // 메타 정보
  await kvSet('metrics:meta', {
    lastUpdated: new Date().toISOString(),
    dataDate: today,
    leadCount: leads.length,
    histCount: histRecords.length,
  });
  console.log('Done!');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

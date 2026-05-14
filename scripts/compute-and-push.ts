/**
 * 로컬 JSON에서 데이터를 읽고 지표를 계산하여 Vercel KV에 저장
 * GitHub Actions에서 실행됨
 */
import fs from 'fs';
import path from 'path';
import { AirtableLead, AirtableHistory, TrendEntry } from '../src/lib/types';
import { buildHistByLead, computeRange } from '../src/lib/metrics/index';
import { formatDate } from '../src/lib/metrics/biz-date';
import { KV_DAILY_TTL, KV_WEEKLY_TTL, KV_TREND_TTL, TREND_DAYS } from '../src/lib/constants';

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

function getDateStr(daysAgo: number): string {
  const d = new Date();
  // KST
  d.setTime(d.getTime() + 9 * 60 * 60 * 1000);
  d.setDate(d.getDate() - daysAgo);
  return formatDate(d);
}

function getISOWeekInfo(dateStr: string): { weekKey: string; monday: string; sunday: string } {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = d.getUTCDay(); // 0=일, 1=월, ..., 6=토
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  // ISO week 번호 계산
  const jan4 = new Date(Date.UTC(monday.getUTCFullYear(), 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const jan4Monday = new Date(jan4);
  jan4Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const weekNum = Math.ceil(((monday.getTime() - jan4Monday.getTime()) / 86400000 + 1) / 7);

  // ISO week year (연말/연초 경계 처리)
  let isoYear = monday.getUTCFullYear();
  if (monday.getUTCMonth() === 0 && weekNum > 50) isoYear--;
  if (monday.getUTCMonth() === 11 && weekNum === 1) isoYear++;

  const weekKey = `${isoYear}-W${String(weekNum).padStart(2, '0')}`;
  return { weekKey, monday: formatDate(monday), sunday: formatDate(sunday) };
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
  await kvSet(`metrics:daily:${today}`, todayMetrics, KV_DAILY_TTL);
  await kvSet('metrics:daily:latest', todayMetrics);
  console.log(`Saved metrics:daily:${today} + latest`);

  // 최근 14일 트렌드 계산
  const trend: TrendEntry[] = [];
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
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

  await kvSet('metrics:trend:14d', trend, KV_TREND_TTL);
  console.log(`Saved trend (${trend.length} days)`);

  // === 주간 메트릭 ===
  // KV_WEEKLY_TTL from constants (28주 = 196일)

  function computeWeekMetrics(dateStr: string) {
    const week = getISOWeekInfo(dateStr);
    console.log(`Computing weekly metrics for ${week.weekKey} (${week.monday} ~ ${week.sunday})...`);
    const metrics = computeRange(week.monday, week.sunday, leads, histByLead);
    return { week, metrics };
  }

  // 현재 주차
  const { week: thisWeek, metrics: thisWeekMetrics } = computeWeekMetrics(today);
  await kvSet(`metrics:weekly:${thisWeek.weekKey}`, thisWeekMetrics, KV_WEEKLY_TTL);
  await kvSet('metrics:weekly:latest', thisWeekMetrics);
  console.log(`Saved metrics:weekly:${thisWeek.weekKey} + latest`);

  // 직전 주차 (보정: 일요일 데이터까지 반영된 최종본)
  const { week: lastWeek, metrics: lastWeekMetrics } = computeWeekMetrics(getDateStr(7));
  await kvSet(`metrics:weekly:${lastWeek.weekKey}`, lastWeekMetrics, KV_WEEKLY_TTL);
  console.log(`Saved metrics:weekly:${lastWeek.weekKey} (prev week)`);

  // === 월간 메트릭 ===

  function computeMonthMetrics(ymStr: string) {
    // ymStr 'YYYY-MM' → 해당 월 1일 ~ 말일
    const [y, m] = ymStr.split('-').map(Number);
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate(); // m은 1-12, 다음 달 0일 = 이번 달 말일
    const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    console.log(`Computing monthly metrics for ${ymStr} (${start} ~ ${end})...`);
    return { ym: ymStr, start, end, metrics: computeRange(start, end, leads, histByLead) };
  }

  function ymFromDateStr(dateStr: string): string {
    return dateStr.slice(0, 7); // 'YYYY-MM'
  }

  // 이번 달
  const thisYM = ymFromDateStr(today);
  const thisMonth = computeMonthMetrics(thisYM);
  // 월간 TTL은 무제한 (영구 저장)
  await kvSet(`metrics:monthly:${thisYM}`, thisMonth.metrics);
  await kvSet('metrics:monthly:latest', thisMonth.metrics);
  console.log(`Saved metrics:monthly:${thisYM} + latest`);

  // 직전 월 (전월 데이터가 그달 마지막날까지 반영되도록 매번 다시 계산)
  const prevDate = new Date(`${today}T12:00:00Z`);
  prevDate.setUTCDate(1);
  prevDate.setUTCMonth(prevDate.getUTCMonth() - 1);
  const prevYM = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;
  const prevMonth = computeMonthMetrics(prevYM);
  await kvSet(`metrics:monthly:${prevYM}`, prevMonth.metrics);
  console.log(`Saved metrics:monthly:${prevYM} (prev month)`);

  // === 전체 기간 메트릭 ===
  // 수집된 데이터의 실제 범위(유입시간 min~max)로 집계
  let minInflow: Date | null = null;
  let maxInflow: Date | null = null;
  for (const l of leads) {
    const t = l.fields.유입시간;
    if (!t) continue;
    const d = new Date(t.replace('Z', '+00:00'));
    if (isNaN(d.getTime())) continue;
    if (!minInflow || d < minInflow) minInflow = d;
    if (!maxInflow || d > maxInflow) maxInflow = d;
  }

  // 이력관리(상태변경 로그) 범위도 별도 파악 — 처리/컨택 판정 신뢰 구간
  let minHist: Date | null = null;
  let maxHist: Date | null = null;
  for (const h of histRecords) {
    const t = h.fields['Created time'];
    if (!t) continue;
    const d = new Date(t.replace('Z', '+00:00'));
    if (isNaN(d.getTime())) continue;
    if (!minHist || d < minHist) minHist = d;
    if (!maxHist || d > maxHist) maxHist = d;
  }

  let allRange: { start: string; end: string } | null = null;
  if (minInflow && maxInflow) {
    // KST 영업일로 변환
    const toKstBiz = (utc: Date) => {
      const kst = new Date(utc.getTime() + 9 * 3600 * 1000);
      const hour = kst.getUTCHours();
      const d = new Date(kst);
      if (hour >= 20) d.setUTCDate(d.getUTCDate() + 1);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    };
    const startAll = toKstBiz(minInflow);
    const endAll = toKstBiz(maxInflow);
    allRange = { start: startAll, end: endAll };

    console.log(`Computing all-time metrics for ${startAll} ~ ${endAll}...`);
    const allMetrics = computeRange(startAll, endAll, leads, histByLead);

    // 전체 모드 전용: 메모/최종결과 기준 분류
    let 신규 = 0;
    let 잔존 = 0;
    let 처리완료 = 0;
    for (const l of leads) {
      const memoLinks = l.fields['[콜]메모 관리'] || [];
      const hasMemo = Array.isArray(memoLinks) ? memoLinks.length > 0 : Boolean(memoLinks);
      const final = l.fields['[콜]최종 결과'];
      if (final) 처리완료++;
      else if (hasMemo) 잔존++;
      else 신규++;
    }
    allMetrics.전체분류 = { 신규, 잔존, 처리완료, 합계: 신규 + 잔존 + 처리완료 };

    await kvSet('metrics:all', allMetrics);
    console.log(`Saved metrics:all (${startAll} ~ ${endAll}) — 신규 ${신규} · 잔존 ${잔존} · 처리완료 ${처리완료}`);
  }

  const toKstIso = (utc: Date | null) =>
    utc ? new Date(utc.getTime() + 9 * 3600 * 1000).toISOString().replace('Z', '+09:00') : null;

  // 메타 정보
  await kvSet('metrics:meta', {
    lastUpdated: new Date().toISOString(),
    dataDate: today,
    leadCount: leads.length,
    histCount: histRecords.length,
    데이터범위: allRange
      ? {
          리드_시작: allRange.start,
          리드_끝: allRange.end,
          리드_시작_KST: toKstIso(minInflow),
          리드_끝_KST: toKstIso(maxInflow),
          이력_시작_KST: toKstIso(minHist),
          이력_끝_KST: toKstIso(maxHist),
        }
      : null,
  });
  console.log('Done!');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

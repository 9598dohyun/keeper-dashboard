/**
 * 진단 화면의 조회 기간 — 일간 / 주별 / 월별.
 *
 * 주는 월요일 시작(ISO), 일요일 종료. 월은 달력 월(8월·9월).
 * "최근 N일" 방식과 달리 경계가 고정돼 있어 같은 주·달을 다시 조회하면 같은 값이 나온다.
 */
import { formatDate } from '../metrics/biz-date';

export type PeriodKind = 'day' | 'week' | 'month';

export interface PeriodRef {
  kind: PeriodKind;
  /** day: YYYY-MM-DD / week: YYYY-Www(월요일 기준) / month: YYYY-MM */
  id: string;
}

export interface PeriodRange {
  kind: PeriodKind;
  id: string;
  label: string;
  시작: string;
  종료: string;
}

function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** 그 날짜가 속한 주의 월요일 */
export function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // getDay: 0=일 … 6=토. 월요일이 되려면 일요일은 -6, 그 외는 1-day
  const diff = x.getDay() === 0 ? -6 : 1 - x.getDay();
  return addDays(x, diff);
}

/**
 * ISO 주차 id (YYYY-Www).
 * 연말·연초에 주가 해를 걸치므로 목요일이 속한 해를 그 주의 해로 본다(ISO 8601).
 */
export function weekIdOf(d: Date): string {
  const mon = mondayOf(d);
  const thu = addDays(mon, 3);
  const year = thu.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const firstThu = addDays(mondayOf(jan1), 3);
  const week = Math.round((thu.getTime() - firstThu.getTime()) / (7 * 86400_000)) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function monthIdOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 주차 id → 그 주의 월요일 */
function mondayFromWeekId(id: string): Date {
  const [y, w] = id.split('-W');
  const year = Number(y);
  const week = Number(w);
  const jan1 = new Date(year, 0, 1);
  const firstMon = mondayOf(addDays(mondayOf(jan1), 3)); // 1주차의 월요일
  return addDays(firstMon, (week - 1) * 7);
}

/** 기간 id → 시작·종료 날짜와 표시 라벨 */
export function resolvePeriod(kind: PeriodKind, id: string): PeriodRange {
  if (kind === 'day') {
    const d = parseYMD(id);
    return { kind, id, label: id, 시작: id, 종료: id };
  }
  if (kind === 'week') {
    const mon = mondayFromWeekId(id);
    const sun = addDays(mon, 6);
    const 시작 = formatDate(mon);
    const 종료 = formatDate(sun);
    return { kind, id, label: `${시작.slice(5)} ~ ${종료.slice(5)}`, 시작, 종료 };
  }
  const [y, m] = id.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  return {
    kind,
    id,
    label: `${m}월`,
    시작: formatDate(first),
    종료: formatDate(last),
  };
}

/**
 * 오늘 기준으로 고를 수 있는 기간 목록 (최신순).
 * 데이터가 없는 기간까지 나열하지 않도록 시작일(since)로 자른다.
 */
export function listPeriods(kind: PeriodKind, today: Date, since: string): PeriodRange[] {
  const out: PeriodRange[] = [];
  const floor = parseYMD(since);

  if (kind === 'day') {
    for (let d = new Date(today); d >= floor; d = addDays(d, -1)) {
      out.push(resolvePeriod('day', formatDate(d)));
    }
    return out;
  }

  if (kind === 'week') {
    for (let mon = mondayOf(today); addDays(mon, 6) >= floor; mon = addDays(mon, -7)) {
      out.push(resolvePeriod('week', weekIdOf(mon)));
    }
    return out;
  }

  for (let m = new Date(today.getFullYear(), today.getMonth(), 1); ; m = new Date(m.getFullYear(), m.getMonth() - 1, 1)) {
    const last = new Date(m.getFullYear(), m.getMonth() + 1, 0);
    if (last < floor) break;
    out.push(resolvePeriod('month', monthIdOf(m)));
  }
  return out;
}

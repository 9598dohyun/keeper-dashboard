/**
 * 영업일 계산 (20 to 20 기준)
 * 영업일 d = 전날 20:00 KST ~ 당일 20:00 KST
 */
import { BIZ_DAY_CUTOFF_HOUR } from '../constants';

const KST_OFFSET = 9 * 60; // minutes

export function toKST(dt: Date): Date {
  const utcMs = dt.getTime() + dt.getTimezoneOffset() * 60000;
  return new Date(utcMs + KST_OFFSET * 60000);
}

export function parseUTC(s: string | undefined | null): Date | null {
  if (!s) return null;
  const d = new Date(s.replace('Z', '+00:00'));
  return isNaN(d.getTime()) ? null : d;
}

/** KST datetime → 영업일 date string (YYYY-MM-DD). 20시 이후면 다음날 영업일 */
export function bizDate(dtKst: Date): string {
  const hour = dtKst.getHours();
  const d = new Date(dtKst);
  if (hour >= BIZ_DAY_CUTOFF_HOUR) {
    d.setDate(d.getDate() + 1);
  }
  return formatDate(d);
}

/** 영업일 d의 시작: 전날 20:00 KST (UTC) */
export function bizDayStartUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  // 전날 20:00 KST = 전날 11:00 UTC
  const prev = new Date(Date.UTC(y, m - 1, d - 1, 20 - KST_OFFSET / 60));
  return prev;
}

/** 영업일 d의 종료: 당일 20:00 KST (UTC) */
export function bizDayEndUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 20 - KST_OFFSET / 60));
}

/** Date → YYYY-MM-DD */
export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD → 전날 */
export function prevDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d - 1);
  return formatDate(dt);
}

/** YYYY-MM-DD → 다음날 */
export function nextDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + 1);
  return formatDate(dt);
}

/** UTC datetime이 영업일 범위 [startDate, endDate] 내인지 */
export function inBizRange(dt: Date | null, startDate: string, endDate: string): boolean {
  if (!dt) return false;
  const start = bizDayStartUTC(startDate);
  const end = bizDayEndUTC(endDate);
  return dt >= start && dt < end;
}

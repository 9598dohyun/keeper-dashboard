import { HistEvent } from '../types';
import { bizDate, toKST } from './biz-date';

function isExcludedAbsence(txt: string): boolean {
  return (txt.includes('부재중: 유입') || txt.includes('부재중상태: 유입'));
}

/** targetDate 영업일에 [상태변경] 이벤트 존재 (부재중:유입 제외) */
export function hadContactAction(
  leadId: string,
  histByLead: Map<string, HistEvent[]>,
  targetDate: string
): boolean {
  const events = histByLead.get(leadId) || [];
  for (const h of events) {
    if (!h.ts) continue;
    if (bizDate(toKST(h.ts)) !== targetDate) continue;
    if (h.이력.startsWith('[상태변경]')) {
      if (isExcludedAbsence(h.이력)) continue;
      return true;
    }
  }
  return false;
}

/** 영업일 범위 내 [상태변경] 이벤트 존재 */
export function hadContactActionInRange(
  leadId: string,
  histByLead: Map<string, HistEvent[]>,
  startDate: string,
  endDate: string
): boolean {
  const events = histByLead.get(leadId) || [];
  for (const h of events) {
    if (!h.ts) continue;
    const d = bizDate(toKST(h.ts));
    if (d < startDate || d > endDate) continue;
    if (h.이력.startsWith('[상태변경]')) {
      if (isExcludedAbsence(h.이력)) continue;
      return true;
    }
  }
  return false;
}

/** 영업일 범위 내 부재중 이벤트 존재 */
export function hadMissedContactInRange(
  leadId: string,
  histByLead: Map<string, HistEvent[]>,
  startDate: string,
  endDate: string
): boolean {
  const events = histByLead.get(leadId) || [];
  for (const h of events) {
    if (!h.ts) continue;
    const d = bizDate(toKST(h.ts));
    if (d < startDate || d > endDate) continue;
    if (h.이력.includes('부재중') && !h.이력.includes('유입')) {
      return true;
    }
  }
  return false;
}

/** 유입 후 첫 실제 [상태변경] (부재중:유입 제외) */
export function firstContactTs(
  leadId: string,
  histByLead: Map<string, HistEvent[]>
): Date | null {
  const events = histByLead.get(leadId) || [];
  for (const h of events) {
    if (h.이력.startsWith('[상태변경]')) {
      if (isExcludedAbsence(h.이력)) continue;
      return h.ts;
    }
  }
  return null;
}

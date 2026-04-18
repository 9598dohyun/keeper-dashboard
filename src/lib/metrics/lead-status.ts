import { AirtableLead, HistEvent } from '../types';
import { bizDate, toKST, parseUTC } from './biz-date';

export function isSuccess(finalResult: string | undefined | null): boolean {
  if (!finalResult) return false;
  return finalResult.startsWith('결제 완료');
}

export function isFail(finalResult: string | undefined | null): boolean {
  return finalResult === '실패';
}

export function isAlive(finalResult: string | undefined | null): boolean {
  return !finalResult;
}

/** 성공/실패 처리 영업일. 이력관리 우선, 없으면 수정일자 폴백. */
export function processedDate(
  lead: AirtableLead,
  histByLead: Map<string, HistEvent[]>
): string | null {
  const final = lead.fields['[콜]최종 결과'];
  if (!final) return null;

  const events = histByLead.get(lead.id) || [];
  for (let i = events.length - 1; i >= 0; i--) {
    const h = events[i];
    if (h.이력.includes('[상태변경]') && h.이력.includes('최종결과') && h.ts) {
      return bizDate(toKST(h.ts));
    }
  }

  const mod = parseUTC(lead.fields.수정일자);
  return mod ? bizDate(toKST(mod)) : null;
}

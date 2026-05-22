import { AirtableLead, HistEvent } from '../types';
import { bizDate, toKST } from './biz-date';

const PROCESSED_FIELD_VALUES = new Set(['실패', 'B2B', '중복문의']);

export function isSuccess(finalResult: string | undefined | null): boolean {
  if (!finalResult) return false;
  return finalResult.startsWith('결제 완료');
}

export function isFail(finalResult: string | undefined | null): boolean {
  return finalResult === '실패';
}

/**
 * 피추천인 [콜]최종 결과 필드 기준 처리완료 판정.
 * 이력관리 [상태변경] 최종결과 이벤트가 없는 과거 리드(2026-04-09 이전 유입·트리거 누락분)
 * 잔존 과대 집계 보완용.
 */
export function isProcessedByLeadField(finalResult: string | undefined | null): boolean {
  if (!finalResult) return false;
  const s = finalResult.trim();
  if (s.startsWith('결제 완료')) return true;
  return PROCESSED_FIELD_VALUES.has(s);
}

/**
 * ref_date 영업일 마감 시점에 살아있는 리드인지 판정.
 * 1) 이력관리 [상태변경] 최종결과 처리일자가 ref_date 이전이면 처리완료(살아있지 않음)
 * 2) 처리일자가 ref_date 이후면 그 시점엔 살아있었음
 * 3) 이력관리에 처리 이벤트가 없으면 피추천인 [콜]최종 결과 필드로 폴백 판정
 */
export function isAliveAt(
  lead: AirtableLead,
  histByLead: Map<string, HistEvent[]>,
  refDate: string
): boolean {
  const procD = processedDate(lead, histByLead);
  if (procD) {
    return procD > refDate;
  }
  return !isProcessedByLeadField(lead.fields['[콜]최종 결과']);
}

/**
 * 성공/실패 처리 영업일.
 * 이력관리 [상태변경] 최종결과 이벤트 시점만 사용. 수정일자 폴백 사용 금지.
 * (메모 편집 등으로 수정일자가 갱신되어 과대 집계 유발하므로 2026-04-21에 폴백 제거.)
 */
export function processedDate(
  lead: AirtableLead,
  histByLead: Map<string, HistEvent[]>
): string | null {
  const events = histByLead.get(lead.id) || [];
  for (let i = events.length - 1; i >= 0; i--) {
    const h = events[i];
    if (h.이력.includes('[상태변경]') && h.이력.includes('최종결과') && h.ts) {
      return bizDate(toKST(h.ts));
    }
  }
  return null;
}

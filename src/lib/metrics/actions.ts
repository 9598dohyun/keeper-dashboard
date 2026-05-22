import { HistEvent, MemoDatesByLead } from '../types';
import { bizDate, toKST } from './biz-date';

function isExcludedAbsence(txt: string): boolean {
  return (txt.includes('부재중: 유입') || txt.includes('부재중상태: 유입'));
}

/**
 * 일괄 자동화/마이그레이션 이벤트 판정.
 * 상담사 실제 컨택이 아닌 시스템 일괄 변경이라 컨택/부재 카운트에서 제외.
 * - 프로모션 상태변경: 영업 컨택 아님
 * - '이력관리 테이블 용' 텍스트 포함: 마이그레이션·일괄 보정 흔적 (2026-05-20 9~11시 사례)
 * - 부재중3회: 자동화에서 3회 시도 완료를 닫는 결과 이벤트. 실제 컨택 시도와는 별도의 마감 신호
 */
function isBulkAutomationEvent(txt: string): boolean {
  if (!txt) return false;
  if (txt.includes('이력관리 테이블 용')) return true;
  if (txt.startsWith('[상태변경] 프로모션')) return true;
  if (txt.includes('부재중3회') || txt.includes('부재중 3회')) return true;
  return false;
}

/** 이력 텍스트에서 최종결과 값 추출. 'A → B' 형태면 신규값(B) 반환. */
function parseFinalResultFromHist(txt: string): string | null {
  if (!txt.includes('최종결과')) return null;
  for (const sep of ['최종결과 : ', '최종결과: ']) {
    if (txt.includes(sep)) {
      let value = txt.split(sep, 2)[1].trim();
      if (value.includes('→')) {
        value = value.split('→', 2)[1].trim();
      }
      return value;
    }
  }
  return '';
}

function isSuccessResult(r: string | null): boolean {
  if (!r) return false;
  return r.startsWith('결제 완료');
}

function isFailResult(r: string | null): boolean {
  return r === '실패';
}

/**
 * targetDate 영업일 컨택 여부.
 * 메모 관리에 당일 '생성자 있는' 메모 OR 이력관리에 당일 [상태변경] 최종결과(성공/실패) 이벤트.
 */
export function hadContactAction(
  leadId: string,
  histByLead: Map<string, HistEvent[]>,
  targetDate: string,
  memoDatesByLead?: MemoDatesByLead
): boolean {
  if (memoDatesByLead?.get(leadId)?.has(targetDate)) {
    return true;
  }
  const events = histByLead.get(leadId) || [];
  for (const h of events) {
    if (!h.ts) continue;
    if (bizDate(toKST(h.ts)) !== targetDate) continue;
    if (isBulkAutomationEvent(h.이력)) continue;
    const result = parseFinalResultFromHist(h.이력);
    if (result && (isSuccessResult(result) || isFailResult(result))) {
      return true;
    }
  }
  return false;
}

/**
 * 영업일 [start, end] 범위 컨택 여부.
 * 메모 관리에 기간 내 '생성자 있는' 메모 OR 이력관리에 기간 내 [상태변경] 최종결과(성공/실패) 이벤트.
 */
export function hadContactActionInRange(
  leadId: string,
  histByLead: Map<string, HistEvent[]>,
  startDate: string,
  endDate: string,
  memoDatesByLead?: MemoDatesByLead
): boolean {
  const memoMap = memoDatesByLead?.get(leadId);
  if (memoMap) {
    for (const memoD of memoMap.keys()) {
      if (memoD >= startDate && memoD <= endDate) return true;
    }
  }
  const events = histByLead.get(leadId) || [];
  for (const h of events) {
    if (!h.ts) continue;
    const d = bizDate(toKST(h.ts));
    if (d < startDate || d > endDate) continue;
    if (isBulkAutomationEvent(h.이력)) continue;
    const result = parseFinalResultFromHist(h.이력);
    if (result && (isSuccessResult(result) || isFailResult(result))) {
      return true;
    }
  }
  return false;
}

/**
 * 영업일 범위 내 마지막 [상태변경]이 부재중인지 판정.
 * 부재중 이벤트가 있더라도 이후 다른 상태변경(성공/실패/컨택)이 있으면 부재중 아님.
 * 일괄 자동화 이벤트는 무시.
 */
export function hadMissedContactInRange(
  leadId: string,
  histByLead: Map<string, HistEvent[]>,
  startDate: string,
  endDate: string
): boolean {
  const events = histByLead.get(leadId) || [];
  let lastStatus: 'missed' | 'other' | null = null;
  for (const h of events) {
    if (!h.ts) continue;
    const d = bizDate(toKST(h.ts));
    if (d < startDate || d > endDate) continue;
    const txt = h.이력;
    if (!txt.startsWith('[상태변경]')) continue;
    if (isExcludedAbsence(txt)) continue;
    if (isBulkAutomationEvent(txt)) continue;
    if (txt.includes('부재중')) {
      lastStatus = 'missed';
    } else {
      lastStatus = 'other';
    }
  }
  return lastStatus === 'missed';
}

/** 유입 후 첫 실제 [상태변경] (부재중:유입·일괄 자동화 이벤트 제외) */
export function firstContactTs(
  leadId: string,
  histByLead: Map<string, HistEvent[]>
): Date | null {
  const events = histByLead.get(leadId) || [];
  for (const h of events) {
    if (h.이력.startsWith('[상태변경]')) {
      if (isExcludedAbsence(h.이력)) continue;
      if (isBulkAutomationEvent(h.이력)) continue;
      return h.ts;
    }
  }
  return null;
}

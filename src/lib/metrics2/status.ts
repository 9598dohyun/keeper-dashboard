/**
 * [콜]최종 결과 값 판정 (필드 기반)
 * 인바운드: 결제 완료 (영원)/결제 완료 (한화비전)/중복문의/부재중 실패/실패/B2B/빈값
 * SKB:      결제 완료/중복문의/실패/B2B/빈값
 */

/** 결제 완료 계열 (성공) */
export function isPaid(final: string | undefined): boolean {
  return !!final && final.startsWith('결제 완료');
}

export function isDuplicate(final: string | undefined): boolean {
  return final === '중복문의';
}

export function isB2B(final: string | undefined): boolean {
  return final === 'B2B';
}

/** 빈값 = 아직 처리 안 된 활성 리드 */
export function isActive(final: string | undefined): boolean {
  return !final || final.trim() === '';
}

/** 실패 계열 ('실패' + '부재중 실패') — 결제·중복·B2B·활성이 아닌 것 */
export function isFail(final: string | undefined): boolean {
  if (isActive(final)) return false;
  return !isPaid(final) && !isDuplicate(final) && !isB2B(final);
}

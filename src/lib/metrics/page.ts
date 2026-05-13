import { AirtableLead } from '../types';

/**
 * 페이지 경로 정규화.
 * 사용자가 어느 랜딩 페이지에서 유입됐는지 식별.
 *
 * 우선순위:
 *   1. `진입경로` 필드 — 가장 신뢰성 높음 (예: '/calculator', '/trial', '/cal/lead')
 *   2. `[참고]전체유입경로`의 마지막 슬래시 뒤 path — 폴백
 *   3. '(미상)'
 *
 * 정규화:
 *   - 앞에 '/' 없으면 추가
 *   - 쿼리스트링/해시 제거
 *   - 빈 값 또는 단일 '/' → '/'(메인)
 */
export function normalizePage(fields: AirtableLead['fields']): string {
  const raw = (fields.진입경로 || '').trim();
  if (raw) {
    return cleanPath(raw);
  }

  // 폴백: 전체유입경로의 마지막 세그먼트가 path일 가능성
  // 예: 'facebook.business / 260413_ahnstar2 / /calculator' → '/calculator'
  const full = fields['[참고]전체유입경로'] || '';
  if (full) {
    const parts = full.split('/').map(p => p.trim()).filter(Boolean);
    // path는 보통 '/'로 시작했던 것이 split되면서 흔적이 사라지므로
    // 마지막 세그먼트를 후보로 보되, 명백한 페이지 패턴인지 확인
    const last = parts[parts.length - 1];
    if (last && (last.includes('.') === false) && /^[a-z\-_]+$/i.test(last)) {
      return cleanPath('/' + last);
    }
  }

  return '(미상)';
}

function cleanPath(p: string): string {
  // 쿼리스트링/해시 제거
  let s = p.split('?')[0].split('#')[0].trim();
  if (!s) return '(미상)';
  // 앞에 '/' 보장
  if (!s.startsWith('/')) s = '/' + s;
  // trailing slash 정리 (단, '/' 단독은 유지)
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

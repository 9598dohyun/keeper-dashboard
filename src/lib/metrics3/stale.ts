/**
 * 방치 리드 판정
 *
 * 방치 = 최종결과가 비어 있고(미확정), 제외 대상이 아닌 리드.
 * 15일을 조치 기준선으로 두는 근거는 실측이다.
 * 처리 지연 15일 초과 구간의 전환율이 7.29%로, 1-3일 구간(22.90%)의 3분의 1 이하다.
 */
import { D3Record, StaleBucket } from './types';

/** 조치 기준선 (일) */
export const STALE_THRESHOLD_DAYS = 15;

/** 미확정 = 최종결과 빈값 */
export function isUnresolved(r: D3Record): boolean {
  const f = r.fields['[콜]최종 결과'];
  return !f || f.trim() === '';
}

/**
 * 방치 판정에서 제외할 리드
 * - 연락 금지: 응대 대상이 아님
 * - 전화번호 중복여부 기재: 다른 레코드로 관리되는 중복 건
 *
 * 2026-08-11 실측 기준 인바운드 6~8월 미확정 1,674건 중 85건이 제외 대상
 * (연락 금지 0건, 중복 85건).
 */
export function isExcludedFromStale(r: D3Record): boolean {
  if (r.fields['연락 금지']) return true;
  const dup = r.fields['전화번호 중복여부'];
  if (dup && dup.trim() !== '') return true;
  return false;
}

/** 경과일 → 버킷 */
export function staleBucketOf(days: number): StaleBucket {
  if (days <= 3) return '0-3일';
  if (days <= 7) return '4-7일';
  if (days <= 14) return '8-14일';
  if (days <= 30) return '15-30일';
  if (days <= 60) return '31-60일';
  return '61일+';
}

export const STALE_BUCKET_ORDER: StaleBucket[] = [
  '0-3일',
  '4-7일',
  '8-14일',
  '15-30일',
  '31-60일',
  '61일+',
];

/** 해당 버킷이 조치 대상인지 (15일 이상) */
export function isActionableBucket(b: StaleBucket): boolean {
  return b === '15-30일' || b === '31-60일' || b === '61일+';
}

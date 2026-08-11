/**
 * 유입 출처 분해
 *
 * UTM_source(광고 매체)와 진입경로(랜딩 유형)는 성격이 다른 축이라 분리해서 본다.
 * 기존 metrics2의 normalizeChannel2는 둘을 하나로 합치는데(UTM 우선, 없으면 진입경로),
 * 그러면 "같은 랜딩인데 매체별로 전환이 다른" 패턴이 사라진다.
 *
 * 2026-08-11 실측(인바운드 6~8월 4,276건):
 *   UTM_source 82.4% / 진입경로 97.6% / 페이지경로 0% (전량 미기재 — 사용 불가)
 *   둘 다 있는 건 3,507건으로 교차 분석이 가능하다.
 */
import { D3Record } from './types';

/**
 * 값이 비어 있는 경우의 표기.
 * "유입 출처가 없다"가 아니라 "출처를 확인하지 못했다"는 뜻이므로 (미확인)으로 둔다.
 * 실측 상 이 구간의 전환율이 높게 나오는데(UTM 미확인 751건 중 결제 143건 = 19.0%),
 * 대표전화·지인추천 등 추적이 안 붙는 경로가 섞여 있기 때문으로 보인다.
 * 따라서 다른 매체와 같은 선상에서 비교하면 안 되고, 별도 구분이 필요하다.
 */
export const UNKNOWN = '(미확인)';

/** 광고 매체 */
export function utmSourceOf(r: D3Record): string {
  return r.fields.UTM_source?.trim() || UNKNOWN;
}

/** 랜딩 유형. 페이지경로 필드는 전량 비어 있어 쓰지 않는다 */
export function entryPathOf(r: D3Record): string {
  return r.fields.진입경로?.trim() || UNKNOWN;
}

/** 해당 세그먼트 키가 미확인 구간인지 */
export function isUnknownKey(key: string): boolean {
  return key.includes(UNKNOWN);
}

/** 교차 키 */
export function crossKeyOf(r: D3Record): string {
  return `${utmSourceOf(r)} × ${entryPathOf(r)}`;
}

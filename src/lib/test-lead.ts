/**
 * 테스트 리드 판별 (대시보드·진단 공용)
 *
 * 고객명에 'test'가 들어간 건은 내부 테스트 입력이므로 집계에서 제외한다.
 * 2026-08-11 실측: 인바운드 11,306건 중 8건('test', 'test22', '김문성(test)',
 * '이도현test' 등), SKB 0건.
 *
 * 개인정보 원칙: 이름 값 자체는 KV·JSON에 저장하지 않는다.
 * fetch 단계에서 이 판정에만 쓰고, 판정 결과(_isTest 플래그)만 남긴 뒤 이름은 버린다.
 */

/** 인바운드는 '고객명', SKB는 '이름' 필드를 쓴다 */
export const NAME_FIELDS = ['고객명', '이름'] as const;

/**
 * 대소문자 무관하게 'test'가 포함되면 테스트 리드로 본다.
 * 부분일치로 두는 이유는 '김문성(test)', '이도현test'처럼 실명에 붙여 쓰는 사례가 있기 때문.
 */
export function isTestName(name: unknown): boolean {
  return typeof name === 'string' && /test/i.test(name);
}

/** 레코드의 이름 필드 중 하나라도 테스트 패턴이면 true */
export function isTestRecord(fields: Record<string, unknown>): boolean {
  return NAME_FIELDS.some((f) => isTestName(fields[f]));
}

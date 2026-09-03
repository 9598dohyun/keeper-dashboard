/** 프로젝트 전역 상수 — 매직 넘버를 한 곳에서 관리 */

export const TOP_CHANNELS_COUNT = 10;
export const TREND_DAYS = 14;
export const POLL_INTERVAL_MS = 300_000; // 5분
export const BIZ_DAY_CUTOFF_HOUR = 20; // 20:00 KST

// SKB+인바운드 대시보드(v2) 집계 시작일 (이 날짜 이후 유입분만 지표화)
export const V2_AGGREGATE_START = '2026-07-29';

// 전환율 진단 대시보드(metrics3)
/**
 * 진단 화면 조회 시작일 — 일간·주별·월별 목록이 이 날짜부터 만들어진다.
 *
 * 2026-08-31(월)로 잘랐다(2026-09-03 변경). 그 이전 구간은 지표 기준이 여러 번 바뀌어
 * (응대 판정 8/26, 결제 판정 결제일 기준 9/3) 지금 화면의 정의와 다른 값이 나온다 —
 * 남겨 두면 같은 화면에서 서로 다른 기준의 숫자를 비교하게 된다.
 * 8/31은 월요일이라 주별 목록도 이 주부터 딱 맞게 시작한다.
 */
export const D3_SNAPSHOT_START = '2026-08-31';

/**
 * 메모수정시각 에어테이블 자동화 적용일 = 접촉 판정 시작일.
 *
 * 재컨택·미컨택은 `메모수정시각`으로 판정하는데 이 필드는 이 날부터 쌓인다.
 * 그 이전에 유입된 리드는 실제로 응대했어도 값이 없어 미컨택으로 잡힌다 —
 * 화면에 이 사실을 함께 표시한다.
 */
export const 접촉_집계시작 = '2026-08-26';
/** 조회 가능한 기간 옵션 (일) */
export const D3_RANGES = [30, 60, 90] as const;

// KV TTL (초)
export const KV_DAILY_TTL = 30 * 24 * 3600; // 30일
export const KV_D3_DAILY_TTL = 180 * 24 * 3600; // 180일 (진단 날짜별 스냅샷)
export const KV_WEEKLY_TTL = 196 * 24 * 3600; // 28주 (196일)
export const KV_TREND_TTL = 24 * 3600; // 1일

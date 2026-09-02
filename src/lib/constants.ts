/** 프로젝트 전역 상수 — 매직 넘버를 한 곳에서 관리 */

export const TOP_CHANNELS_COUNT = 10;
export const TREND_DAYS = 14;
export const POLL_INTERVAL_MS = 300_000; // 5분
export const BIZ_DAY_CUTOFF_HOUR = 20; // 20:00 KST

// SKB+인바운드 대시보드(v2) 집계 시작일 (이 날짜 이후 유입분만 지표화)
export const V2_AGGREGATE_START = '2026-07-29';

// 전환율 진단 대시보드(metrics3)
/** 날짜별 스냅샷 축적 시작일 — 이 날짜부터 하루 1건씩 쌓인다 */
export const D3_SNAPSHOT_START = '2026-08-11';

/**
 * 첫상담/재상담 분해 집계 시작일.
 *
 * 판정에는 결제일이 필요하고, 결제일은 결제 엑셀 원장에만 있다.
 * 원장은 2026-08-26 결제분부터 쌓여 그 이전은 분해할 수 없다.
 * 이 날짜 이전이 걸친 기간을 조회하면 화면에 그 사실을 함께 표시한다.
 */
export const 상담차수_집계시작 = '2026-08-26';
/** 조회 가능한 기간 옵션 (일) */
export const D3_RANGES = [30, 60, 90] as const;

// KV TTL (초)
export const KV_DAILY_TTL = 30 * 24 * 3600; // 30일
export const KV_D3_DAILY_TTL = 180 * 24 * 3600; // 180일 (진단 날짜별 스냅샷)
export const KV_WEEKLY_TTL = 196 * 24 * 3600; // 28주 (196일)
export const KV_TREND_TTL = 24 * 3600; // 1일

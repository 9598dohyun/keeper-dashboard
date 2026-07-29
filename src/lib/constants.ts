/** 프로젝트 전역 상수 — 매직 넘버를 한 곳에서 관리 */

export const TOP_CHANNELS_COUNT = 10;
export const TREND_DAYS = 14;
export const POLL_INTERVAL_MS = 300_000; // 5분
export const BIZ_DAY_CUTOFF_HOUR = 20; // 20:00 KST

// SKB+인바운드 대시보드(v2) 집계 시작일 (이 날짜 이후 유입분만 지표화)
export const V2_AGGREGATE_START = '2026-07-29';

// KV TTL (초)
export const KV_DAILY_TTL = 30 * 24 * 3600; // 30일
export const KV_WEEKLY_TTL = 196 * 24 * 3600; // 28주 (196일)
export const KV_TREND_TTL = 24 * 3600; // 1일

/**
 * 유입 시간대 판정
 *
 * 운영시간은 평일 09:00~19:00 (2026-08 확인 기준).
 * 운영시간이 바뀌면 이 파일의 상수만 수정한다.
 */
import { TimeSegment } from './types';

/** 운영 시작 시각 (포함) */
export const OPEN_HOUR = 9;
/** 운영 종료 시각 (미포함 — 19시는 영업외) */
export const CLOSE_HOUR = 19;

/**
 * KST 기준 Date → 시간대 구분
 * 토·일은 시각과 무관하게 '주말'
 *
 * 주의: toKST()는 로컬 타임존 오프셋을 보정해 KST 벽시계 값을 담아 반환하므로
 * 반드시 로컬 getter(getDay/getHours)로 읽어야 한다 (biz-date.ts의 bizDate와 동일 규약).
 */
export function timeSegmentOf(kst: Date): TimeSegment {
  const day = kst.getDay();
  if (day === 0 || day === 6) return '주말';
  const h = kst.getHours();
  return h >= OPEN_HOUR && h < CLOSE_HOUR ? '운영시간' : '영업외';
}

/** 화면 표시용 라벨 */
export const SEGMENT_LABEL: Record<TimeSegment, string> = {
  운영시간: `운영시간 (평일 ${OPEN_HOUR}-${CLOSE_HOUR}시)`,
  영업외: `영업외 (평일 ${CLOSE_HOUR}-${OPEN_HOUR}시)`,
  주말: '주말',
};

export const SEGMENT_ORDER: TimeSegment[] = ['운영시간', '영업외', '주말'];

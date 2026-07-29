import { V2Record } from './types';

/**
 * 채널 정규화 — UTM_source 우선, 없으면 진입경로 (SKB엔 진입경로 없음)
 */
export function normalizeChannel2(fields: V2Record['fields']): string {
  const utm = fields.UTM_source?.trim();
  if (utm) return utm;
  const jin = fields.진입경로?.trim();
  if (jin) return jin;
  return '(미상)';
}

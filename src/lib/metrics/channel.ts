import { AirtableLead } from '../types';

export function normalizeChannel(fields: AirtableLead['fields']): string {
  const ch = fields['[참고]전체유입경로'] || '';
  if (ch) {
    const first = ch.split('/')[0].trim();
    return first || '(미상)';
  }
  return fields.진입경로 || '(미상)';
}

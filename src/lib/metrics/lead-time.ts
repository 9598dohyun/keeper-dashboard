export interface LeadTimeStats {
  샘플_건: number;
  중앙값_분?: number;
  평균_분?: number;
  최소_분?: number;
  최대_분?: number;
  '≤5분'?: number;
  '5~30분'?: number;
  '30~60분'?: number;
  '1~3시간'?: number;
  '3~12시간'?: number;
  '12시간+'?: number;
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeLeadTimeStats(leadTimesMin: number[]): LeadTimeStats {
  if (leadTimesMin.length === 0) {
    return { 샘플_건: 0 };
  }
  return {
    샘플_건: leadTimesMin.length,
    중앙값_분: round1(median(leadTimesMin)),
    평균_분: round1(mean(leadTimesMin)),
    최소_분: round1(Math.min(...leadTimesMin)),
    최대_분: round1(Math.max(...leadTimesMin)),
    '≤5분': leadTimesMin.filter(m => m <= 5).length,
    '5~30분': leadTimesMin.filter(m => m > 5 && m <= 30).length,
    '30~60분': leadTimesMin.filter(m => m > 30 && m <= 60).length,
    '1~3시간': leadTimesMin.filter(m => m > 60 && m <= 180).length,
    '3~12시간': leadTimesMin.filter(m => m > 180 && m <= 720).length,
    '12시간+': leadTimesMin.filter(m => m > 720).length,
  };
}

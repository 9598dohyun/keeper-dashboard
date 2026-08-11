/**
 * SKB+인바운드 통합관리 베이스 (appyHEg7jKb1Y4s4b) 기준 지표 타입
 * 단일 테이블 필드 기반. 이력 파싱 없음. 부재율 없음. 리드타임 phase 2.
 *
 * 두 날짜 축:
 *  - 응대·전환 지표 = Last Modified 기준 (오늘 수정 = 오늘 응대)
 *  - 유입 건수·채널 = 유입시간 기준
 */

/** 새 베이스의 리드 레코드 (개인정보 연락처 제외) */
export interface V2Record {
  id: string;
  fields: {
    유입시간?: string;
    'Last Modified'?: string;
    '[콜]최종 결과'?: string; // singleSelect (빈값 = 미확정)
    '[콜]담당자'?: string; // singleSelect (빈값 = 미배정)
    UTM_source?: string;
    진입경로?: string; // 인바운드만 존재, SKB엔 없음
  };
}

/** 전환 (오늘 응대 = Last Modified 오늘 기준) */
export interface ConversionMetrics {
  응대: number; // Last Modified가 오늘인 전체 (= 분모)
  결제: number; // 그중 결제 완료 계열 (= 분자)
  전환율_pct: number; // 결제 / 응대 × 100
  // 오늘 응대건의 최종결과 분해 (투명성)
  분해: {
    결제: number;
    실패: number; // 실패 + 부재중 실패
    중복문의: number;
    B2B: number;
    미확정: number; // 오늘 수정됐으나 최종결과 빈값
  };
}

/** 담당자별 오늘 응대·결제·전환율 */
export interface AssigneeMetric {
  담당자: string; // 빈값이면 '(미배정)'
  응대: number;
  결제: number;
  전환율_pct: number;
}

/** 인바운드용 지표 (전환 + 담당자별 + 유입 + 채널) */
export interface InboundMetrics {
  전환: ConversionMetrics;
  담당자별: AssigneeMetric[]; // 응대 많은 순
  유입건수: number; // 유입시간이 집계시작 이후인 건수
  채널_Top: [string, number][]; // 집계시작 이후 유입건의 UTM_source + 진입경로
  /** 날짜별 유입 (집계시작 이후, 유입시간 기준). 스냅샷 차분이 아닌 실제 집계 */
  유입_일자별?: DailyCount[];
}

/** SKB용 지표 (전환 + 담당자별) */
export interface SkbMetrics {
  전환: ConversionMetrics;
  담당자별: AssigneeMetric[];
  유입건수: number;
  /** 날짜별 유입 (집계시작 이후, 유입시간 기준). 스냅샷 차분이 아닌 실제 집계 */
  유입_일자별?: DailyCount[];
}

/** 날짜 1일치 카운트 */
export interface DailyCount {
  날짜: string; // YYYY-MM-DD
  건수: number;
}

/** 레드텔레콤용 (레코드 수만) */
export interface CountMetrics {
  건수_전체: number; // 테이블 전체 레코드 수
  건수_오늘이후: number; // 유입시간이 집계시작 이후인 건수
}

/**
 * 날짜별 추이 1일치 (누적이 아닌 그날 값)
 *
 * v2:daily:{날짜} 스냅샷에서 뽑아 만든다.
 * 유입건수는 스냅샷상 '집계시작 이후 누적'이라 그대로 쓰면 우상향 곡선이 되므로,
 * 전날 누적과의 차이로 그날 유입을 역산한다.
 */
export interface TrendSeries {
  응대: number | null;
  결제: number | null;
  전환율_pct: number | null;
  유입: number | null;
}

export interface TrendPoint {
  날짜: string; // YYYY-MM-DD
  인바운드: TrendSeries;
  skb: TrendSeries;
}

/** KV에 저장하는 대시보드 묶음 */
export interface DashboardV2 {
  인바운드: InboundMetrics;
  skb: SkbMetrics;
  레드텔레콤: CountMetrics;
  집계시작: string; // 'YYYY-MM-DD'
  오늘: string; // 응대 지표 기준일 'YYYY-MM-DD' (KST)
  _meta: {
    updatedAt: string;
    counts: { 인바운드: number; skb: number; 레드텔레콤: number };
  };
}

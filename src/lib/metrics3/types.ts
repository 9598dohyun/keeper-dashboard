/**
 * 전환율 진단 대시보드 지표 타입
 *
 * metrics2(당일 성과, Last Modified 기준)와 달리 이 엔진은 전부 유입시간 기준이다.
 * 목적은 성과 보고가 아니라 방치 리드 탐지.
 */

/** 진단용 리드 레코드 (개인정보 제외) */
export interface D3Record {
  id: string;
  fields: {
    유입시간?: string;
    'Last Modified'?: string;
    첫응대시각?: string;
    '[콜]최종 결과'?: string;
    '[콜]담당자'?: string;
    '[콜]부재중 상태'?: string;
    '[콜]온도감'?: string;
    실패사유?: string;
    UTM_source?: string;
    진입경로?: string;
    '전화번호 중복여부'?: string;
    '연락 금지'?: boolean;
  };
}

/** 유입 시간대 구분 */
export type TimeSegment = '운영시간' | '영업외' | '주말';

/** 경과일 버킷 */
export type StaleBucket = '0-3일' | '4-7일' | '8-14일' | '15-30일' | '31-60일' | '61일+';

/** 리드타임 버킷 */
export type LeadTimeBucket =
  | '0-30분'
  | '30분-1시간'
  | '1-3시간'
  | '3-12시간'
  | '12-24시간'
  | '1일+';

/** 유입 출처 분해 축 */
export type SourceAxis = 'utm' | 'entry' | 'cross';

/** 전환 기본 지표 (유입 기준) */
export interface ConversionStat {
  유입: number;
  결제: number;
  미확정: number;
  /** 결제 ÷ 유입 */
  유입대비_pct: number;
  /** 결제 ÷ (유입 - 미확정) */
  종결대비_pct: number;
  미확정률_pct: number;
}

/** 세그먼트 행 (시간대·채널·담당자 공용) */
export interface SegmentRow extends ConversionStat {
  key: string;
  /** 15일 이상 방치 건수 */
  방치_15일: number;
  /** 미확정 건의 평균 경과일 */
  평균경과일: number;
}

/** 방치 리드 1건 (개인정보 없음 — 상세는 에어테이블에서 확인) */
export interface StaleLead {
  id: string;
  유입일: string;
  경과일: number;
  버킷: StaleBucket;
  시간대: TimeSegment;
  /** 광고 매체 (UTM_source). 값이 없으면 (미확인) */
  매체: string;
  /** 랜딩 유형 (진입경로). 값이 없으면 (미확인) */
  유입페이지: string;
  담당자: string;
  부재중상태: string;
  온도감: string;
}

/** 경과일 버킷별 집계 */
export interface StaleBucketStat {
  버킷: StaleBucket;
  건수: number;
  /** 이 버킷이 조치 대상인지 (15일 이상) */
  조치대상: boolean;
}

/** 리드타임 (첫응대시각 기반) */
export interface LeadTimeStat {
  버킷: LeadTimeBucket;
  신규유입분: number;
  적체소화분: number;
}

/** 실패사유 1행 */
export interface FailReasonRow {
  사유: string;
  건수: number;
  비중_pct: number;
}

/** 테이블 1개(인바운드 또는 SKB)의 진단 결과 */
export interface DiagnosisTable {
  전체: ConversionStat;
  방치버킷: StaleBucketStat[];
  방치리드: StaleLead[];
  시간대별: SegmentRow[];
  /** 광고 매체별 (UTM_source) */
  매체별: SegmentRow[];
  /** 랜딩 유형별 (진입경로) */
  유입페이지별: SegmentRow[];
  /** 매체 × 랜딩 교차 */
  교차별: SegmentRow[];
  담당자별: SegmentRow[];
  리드타임: LeadTimeStat[];
  실패사유: FailReasonRow[];
  /** 실패사유 기재율 — 미기재분이 가려지지 않도록 함께 노출 */
  실패사유_기재: { 기재: number; 실패총건: number; 기재율_pct: number };
  /** 방치 판정에서 제외된 건수 (중복·연락금지 등) */
  방치_제외건수: number;
}

/** KV에 저장하는 진단 대시보드 묶음 */
export interface DiagnosisResult {
  집계일: string;
  기간: { 시작: string; 종료: string; 일수: number };
  인바운드: DiagnosisTable;
  skb: DiagnosisTable;
  meta: {
    updatedAt: string;
    /** 첫응대시각 자동화 적용일 — 이전 유입분은 리드타임 측정 불가 */
    리드타임_집계시작: string;
    /** 날짜별 스냅샷 축적 시작일 — 이전 날짜는 조회 불가 */
    스냅샷_시작: string;
  };
}

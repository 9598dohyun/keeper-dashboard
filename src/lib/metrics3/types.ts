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
    메모수정시각?: string;
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

/**
 * 전환 기본 지표.
 *
 * 주의: `유입`·`미확정`은 **유입일** 기준이고 `결제`는 **결제일** 기준이다 (2026-09-03 변경).
 * 결제 여부의 진짜 소스가 결제 데이터 엑셀이라, 그날 결제된 건을 그날 결제로 세야
 * 대시보드와 숫자가 맞는다. 종전에는 "그날 유입된 리드 중 결제된 것"을 셌기 때문에
 * 9/2 결제 5건 중 유입일이 9/2인 1건만 잡혔다.
 *
 * 두 열의 모집단이 다르므로 `유입대비_pct`는 같은 리드 집합의 비율이 아니다 —
 * 기간이 길어질수록 오차가 줄지만, 하루 단위에서는 비율로 읽지 말 것.
 */
export interface ConversionStat {
  /** 기간 내 유입 건수 (유입일 기준) */
  유입: number;
  /** 기간 내 결제 건수 (결제일 기준) */
  결제: number;
  /**
   * 결제 중 유입일과 결제일이 같은 건 — 첫 컨택에 바로 주문된 것.
   * `첫응대시각`은 보지 않는다 (결제 처리 시 소급 입력돼 신뢰할 수 없음).
   */
  첫컨택주문: number;
  /** 결제 중 유입일과 결제일이 다른 건 — 재컨택을 거쳐 주문된 것 */
  재컨택주문: number;
  /** 결제 ÷ 유입. 모집단이 달라 참고용 */
  유입대비_pct: number;
  /** 결제 ÷ (유입 - 미확정) */
  종결대비_pct: number;
  미확정: number;
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
  /** 그날 접촉건을 신규/재컨택으로 분해. 기간이 하루가 아니면 null */
  재컨택: 재컨택Stat | null;
}

/**
 * 재컨택 분해 — 그날 접촉된 건을 신규 / 재컨택으로 가른다.
 *
 * 기준 (2026-09-03 확정): 그날 `메모수정시각`이 찍힌 건이 그날 접촉된 건이고,
 * 그중 **유입일이 그날이 아니면 재컨택**(과거에 들어온 리드를 다시 건드린 것),
 * 유입일도 그날이면 신규다. `첫응대시각`이 그날보다 앞서면 이미 응대한 뒤
 * 다시 접촉한 것이므로 유입일이 그날이어도 재컨택으로 본다.
 *
 * `메모수정시각`이 비어 있으면 **미컨택** — 신규도 재컨택도 아니다.
 * 아직 아무도 손대지 않은 리드라 접촉 분해의 대상이 아니고, 별도로 센다.
 *
 * 한계: `메모수정시각`은 마지막 메모 수정만 남는 덮어쓰기 필드이고
 * 2026-08-26부터 쌓인다(그 이전 유입분은 값이 없어 전부 미컨택으로 잡힌다).
 * 접촉 횟수는 셀 수 없고 "그날 건드렸는지"까지만 답한다.
 */
export interface 재컨택Stat {
  /** 그날 접촉된 건 (= 신규 + 재컨택) */
  접촉: number;
  /** 그날 유입돼 그날 접촉된 건 */
  신규: number;
  /** 과거 유입인데 그날 접촉된 건 (또는 이미 응대 후 재접촉) */
  재컨택: number;
  /** 재컨택 ÷ 접촉 × 100 */
  재컨택률_pct: number;
  /** 재컨택 건의 유입→해당일 경과일 중앙값. 재컨택이 0이면 null */
  재컨택_경과일_중앙: number | null;
  /** 재컨택 건의 유입→해당일 경과일 최대. 재컨택이 0이면 null */
  재컨택_경과일_최대: number | null;
  /** 기간 내 유입분 중 `메모수정시각`이 비어 아직 접촉되지 않은 건 */
  미컨택: number;
  /** 미컨택 ÷ 기간 유입 × 100 */
  미컨택률_pct: number;
}

/** KV에 저장하는 진단 대시보드 묶음 */
export interface DiagnosisResult {
  집계일: string;
  기간: {
    시작: string;
    종료: string;
    일수: number;
    /** 일간·주별·월별로 조회한 경우에만 채워진다 ("최근 N일"에는 없음) */
    종류?: 'day' | 'week' | 'month';
    id?: string;
    라벨?: string;
  };
  인바운드: DiagnosisTable;
  skb: DiagnosisTable;
  meta: {
    updatedAt: string;
    /** 첫응대시각 자동화 적용일 — 이전 유입분은 리드타임 측정 불가 */
    리드타임_집계시작: string;
    /** 날짜별 스냅샷 축적 시작일 — 이전 날짜는 조회 불가 */
    스냅샷_시작: string;
    /** 결제수를 무엇으로 셌는지. 엑셀 원장이 없으면 airtable */
    결제소스?: 'excel' | 'airtable';
    /** 원장에 담긴 주문 수 (결제소스가 excel일 때) */
    원장_주문수?: number;
    /** 원장이 덮는 시작일. 이 날 이후 유입분만 엑셀 기준으로 판정된다 */
    원장_시작일?: string | null;
  };
}

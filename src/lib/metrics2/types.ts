/**
 * SKB+인바운드 통합관리 베이스 (appyHEg7jKb1Y4s4b) 기준 지표 타입
 * 단일 테이블 필드 기반. 이력 파싱 없음. 부재율 없음. 리드타임 phase 2.
 *
 * 두 날짜 축:
 *  - 응대·전환 지표 = 메모수정시각 기준 (메모를 남긴 = 응대한). 적용일 이전은 Last Modified 폴백
 *  - 유입 건수·채널 = 유입시간 기준
 */

import { RecontactSplit } from './recontact';

/** 새 베이스의 리드 레코드 (개인정보 연락처 제외) */
export interface V2Record {
  id: string;
  fields: {
    유입시간?: string;
    'Last Modified'?: string;
    메모수정시각?: string;
    '[콜]최종 결과'?: string; // singleSelect (빈값 = 미확정)
    '[콜]담당자'?: string; // singleSelect (빈값 = 미배정)
    UTM_source?: string;
    진입경로?: string; // 인바운드만 존재, SKB엔 없음
    /**
     * 레드텔레콤 I/B 전용 필드. 값도 "결제완료"/"부재중 실패"/"실패" 3종뿐이라
     * 다른 테이블의 '[콜]최종 결과'와 별개로 둔다(중복문의·B2B 개념 없음, 담당자 필드 없음).
     */
    최종결과?: string;
  };
}

/** 전환 (오늘 응대 = 메모수정시각 오늘 기준) */
export interface ConversionMetrics {
  응대: number; // 메모수정시각이 오늘인 전체 (= 분모)
  결제: number; // 그중 결제 완료 계열 (= 분자)
  /**
   * 결제 / 응대 × 100.
   * 결제 엑셀 기준일 때는 null — 응대와 결제의 모집단이 달라 비율로 성립하지 않는다.
   */
  전환율_pct: number | null;
  /**
   * 오늘 응대건을 신규 접촉 / 재컨택으로 분해한 값.
   * 접촉이력 스냅샷(data/접촉이력.json)이 쌓인 뒤부터 의미를 갖는다 — 이력이 비면 전부 신규.
   */
  재컨택?: RecontactSplit;
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
  전환율_pct: number | null; // 결제 엑셀 기준일 때는 null
}

/** 인바운드용 지표 (전환 + 담당자별 + 유입 + 채널) */
export interface InboundMetrics {
  전환: ConversionMetrics;
  담당자별: AssigneeMetric[]; // 응대 많은 순
  유입건수: number; // 유입시간이 집계시작 이후인 건수
  채널_Top: [string, number][]; // 집계시작 이후 유입건의 UTM_source + 진입경로
  /** 날짜별 유입 (집계시작 이후, 유입시간 기준). 스냅샷 차분이 아닌 실제 집계 */
  유입_일자별?: DailyCount[];
  /** 날짜별 × 채널별 유입 (집계시작 이후). 기간 탭에서 채널 합산에 쓴다 */
  채널_일자별?: DailyChannelCount[];
}

/** SKB용 지표 (전환 + 담당자별) */
export interface SkbMetrics {
  전환: ConversionMetrics;
  담당자별: AssigneeMetric[];
  유입건수: number;
  /** 날짜별 유입 (집계시작 이후, 유입시간 기준). 스냅샷 차분이 아닌 실제 집계 */
  유입_일자별?: DailyCount[];
}

/**
 * 정보와기술용 지표 (전환 + 담당자별 + 유입 + 채널).
 *
 * 정보와기술 테이블은 대표전화·채널톡 두 채널을 함께 다룬다(채널 구분은 유입경로 필드로 함).
 * 필드명이 인바운드/SKB와 달라(유입날짜·메모완료시각·유입경로)
 * fetch-airtable.ts가 유입시간·메모수정시각·UTM_source로 리네임해 저장한다 —
 * 그 결과 V2Record 형태가 같아 InboundMetrics와 동일한 계산 로직(computeInbound)을 재사용한다.
 */
export type RepPhoneMetrics = InboundMetrics;

/**
 * 레드텔레콤 O/B용 지표 (전환 + 담당자별, 유입 채널 없음).
 *
 * 결제 판정은 엑셀 대조 없이 에어테이블 [콜]최종 결과 == '결제 완료'만으로 바로 센다
 * (다른 테이블과 달리 결제 엑셀 대조 대상이 아니다).
 */
export type RedtelOBMetrics = SkbMetrics;

/**
 * 결제 데이터 엑셀 대조 결과 (scripts/payment-sync/reconcile.py 산출).
 *
 * 결제 여부의 진짜 소스는 오전에 받는 결제 데이터 엑셀이다.
 * 엑셀에 없으면 결제로 세지 않는다 — 에어테이블의 [콜]최종 결과가 '결제 완료'여도 마찬가지.
 * 개인정보를 저장소에 남기지 않기 위해 전화번호가 아닌 레코드 ID로 담는다.
 */
export interface PaymentReconcile {
  기준일: string;
  생성시각: string;
  엑셀파일: string;
  결제_전체: number;
  결제_매칭: number;
  결제ID_인바운드: string[];
  결제ID_SKB: string[];
  결제ID_정보와기술: string[];
  // 레드텔레콤 I/B(키퍼리드) — 2026-10-06부터 엑셀 대조 대상에 포함. O/B는 여전히 제외(응대 개념 없음).
  결제ID_레드텔레콤IB?: string[];
  // 테이블별 주문 건수. 결제ID_*는 레코드ID 집합이라 같은 리드가 여러 주문(같은 날 재구매·증설 등)의
  // 대표로 뽑히면 집합 크기가 실제 주문 건수보다 작아진다 — 표시용 건수는 반드시 이 값을 쓴다.
  결제건수_인바운드: number;
  결제건수_SKB: number;
  결제건수_정보와기술: number;
  결제건수_레드텔레콤IB?: number;
  // 담당자별 결제 건수(주문 단위, 중복 리드 병합 없음). 담당자별 표시는 이 값을 우선 쓴다 —
  // 결제ID_*(레코드ID 집합) 기준으로 배분하면 같은 리드가 여러 주문의 대표로 뽑힐 때
  // 그중 한 건만 잡혀 실제보다 적게 나온다.
  담당자별_결제_인바운드?: Record<string, number>;
  담당자별_결제_SKB?: Record<string, number>;
  담당자별_결제_정보와기술?: Record<string, number>;
  미매칭_건수: number;
  에어테이블만_결제_건수: number;
  // 원장 누적 결제ID — 그날 하루치가 아니라 결제원장.json 전체에서 취소 제외 집계한 것.
  // 채널_일자별처럼 "유입일 기준 코호트 전환"을 계산할 때는 이 값을 써야 한다.
  // 결제건수_*(그날 하루치)로 계산하면 과거에 유입돼 다른 날 결제된 건이 빠진다.
  원장_결제ID_인바운드?: string[];
  원장_결제ID_SKB?: string[];
  원장_결제ID_정보와기술?: string[];
  원장_결제ID_레드텔레콤IB?: string[];
}

/**
 * 매장(주소) 단위 누적 결제 — "누적결제" 탭 전용.
 * 에어테이블 매칭 여부와 무관하게 엑셀 유효 결제 전체(채널 불문)를 센다.
 * 주소가 같으면 매장 1곳으로 묶고, 주소가 공란이면 매장명으로 대체 구분한다.
 * scripts/payment-sync/reconcile.py(data/매장별누적.json)가 생성한다.
 */
export interface StoreRegionRow {
  지역: string; // 8도(광역단위) 이름, 또는 "기타/미상"
  매장수: number;
  결제건수: number;
}

export interface StoreSummary {
  갱신시각: string;
  매장수_전체: number;
  결제건수_전체: number;
  지역별: StoreRegionRow[];
}

/** 날짜 1일치 카운트 */
export interface DailyCount {
  날짜: string; // YYYY-MM-DD
  건수: number;
}

/**
 * 날짜 1일치 × 채널 1개 카운트. 기간(이번주·이번달) 채널 합산에 쓴다.
 *
 * 결제는 "그날 유입된 리드 중 지금까지(계산 시점 기준) 결제로 이어진 건수" —
 * 유입일 기준 코호트 전환이다. 응대·결제(그날 발생 기준)와는 성질이 다르며,
 * 결제 데이터 엑셀 대조가 없으면(대시보드가 에어테이블 최종결과만 볼 때) 계산하지 않는다
 * (에어테이블 [콜]최종 결과만으로는 나중에 결제될 리드를 지금 알 수 없어 과소집계된다).
 */
export interface DailyChannelCount {
  날짜: string; // YYYY-MM-DD (유입일 기준)
  채널: string;
  건수: number; // 그날 유입 건수
  결제?: number; // 그중 결제ID(엑셀 대조)에 매칭된 건수. 대조 없으면 undefined
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
  정보와기술: TrendSeries;
  레드텔레콤_IB: TrendSeries;
}

/** KV에 저장하는 대시보드 묶음 */
export interface DashboardV2 {
  인바운드: InboundMetrics;
  skb: SkbMetrics;
  /** 이번 재편(탭 구조 전체/A/B/C)에서 추가된 필드 — 그 이전 스냅샷엔 없다 */
  레드텔레콤_IB?: InboundMetrics;
  레드텔레콤_OB?: RedtelOBMetrics;
  정보와기술: RepPhoneMetrics;
  집계시작: string; // 'YYYY-MM-DD'
  오늘: string; // 응대 지표 기준일 'YYYY-MM-DD' (KST)
  _meta: {
    updatedAt: string;
    counts: {
      인바운드: number;
      skb: number;
      레드텔레콤_IB: number;
      레드텔레콤_OB: number;
      정보와기술: number;
    };
    /** 결제수 소스. 엑셀 대조를 거치지 않으면 airtable로 남아 화면에 표시된다 */
    결제소스?: {
      종류: 'excel' | 'airtable';
      엑셀파일?: string;
      기준일?: string;
      미매칭_건수?: number;
      에어테이블만_결제_건수?: number;
    };
  };
}

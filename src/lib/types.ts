export interface AirtableLead {
  id: string;
  fields: {
    유입시간?: string;
    수정일자?: string;
    '[콜]최종 결과'?: string;
    '[콜]실패사유'?: string;
    '전화번호 키워드'?: string;
    '[참고]전체유입경로'?: string;
    진입경로?: string;
  };
}

export interface AirtableHistory {
  id: string;
  fields: {
    이력?: string;
    피추천인?: string[];
    '변경 필드값'?: string;
    'Created time'?: string;
  };
}

export interface HistEvent {
  이력: string;
  변경필드: string;
  ts: Date | null;
}

export interface LeadMetrics {
  전날잔존: number;
  오늘신규: number;
  오늘신규_중복: number;
  오늘신규_고유: number;
  오늘잔존: number;
}

export interface ActionMetrics {
  오늘처리총량: number;
  오늘컨택: number;
  오늘컨택_신규: number;
  오늘컨택_기존팔로업: number;
  오늘성공: number;
  오늘성공_신규: number;
  오늘성공_기존: number;
  오늘실패: number;
  오늘실패_중복: number;
  오늘부재: number;
}

export interface KPIMetrics {
  전환율_pct: number;
  전환율_분자: number;
  전환율_분모: number;
  소진율_pct: number;
  소진율_분자: number;
  소진율_분모: number;
  부재율_pct: number;
  부재율_분자: number;
  부재율_분모: number;
  주문전환율_pct: number;
  주문전환율_분자: number;
  주문전환율_분모: number;
}

export interface LeadTimeMetrics {
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

export interface MetricsResult {
  대상기간: { start: string; end: string };
  리드: LeadMetrics;
  액션: ActionMetrics;
  지표: KPIMetrics;
  리드타임: LeadTimeMetrics;
  채널_신규Top: [string, number][];
  시간대별_유입: Record<number, number>;
  시간대별_성공: Record<number, number>;
  시간대별_실패: Record<number, number>;
  _meta: { updatedAt: string; dataDate: string };
}

export interface MetricsMetaInfo {
  lastUpdated: string;
  dataDate: string;
  leadCount: number;
  histCount: number;
}

export interface TrendEntry {
  date: string;
  전날잔존: number;
  오늘신규_고유: number;
  오늘잔존: number;
  오늘성공: number;
  오늘실패: number;
  오늘부재: number;
  전환율: number;
  소진율: number;
  부재율: number;
  리드타임_중앙값: number | null;
}

/** Python push_to_sheets.py가 KV에 저장하는 채널별 일간 breakdown.
 *  키: metrics:channel:daily:{YYYY-MM-DD} */
export interface ChannelBreakdownEntry {
  채널: string;
  전날잔존: number;
  오늘신규: number;
  잔존컨택: number;
  신규컨택: number;
  잔존성공: number;
  신규성공: number;
  프로모션: number;
  실패: number;
  부재: number;
  가용: number;
  컨택: number;
  처리완료: number;
}

/** Python push_to_sheets.py가 KV에 저장하는 담당자별 일간 breakdown.
 *  키: metrics:assignee:daily:{YYYY-MM-DD} */
export interface AssigneeBreakdownEntry {
  담당자: string;
  전날잔존: number;
  오늘신규: number;
  잔존컨택: number;
  신규컨택: number;
  잔존성공: number;
  신규성공: number;
  프로모션: number;
  실패: number;
  부재: number;
  가용: number;
  컨택: number;
  처리완료: number;
}

/** 페이지(진입경로)별 일간 breakdown.
 *  키: metrics:page:daily/weekly/monthly:{KEY} */
export interface PageBreakdownEntry {
  페이지: string;
  전날잔존: number;
  오늘신규: number;
  잔존컨택: number;
  신규컨택: number;
  잔존성공: number;
  신규성공: number;
  프로모션: number;
  실패: number;
  부재: number;
  가용: number;
  컨택: number;
  처리완료: number;
}

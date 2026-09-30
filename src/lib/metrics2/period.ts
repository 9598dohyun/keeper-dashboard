/**
 * 기간(주차별·월별) 합산 요약
 *
 * v2:daily:{날짜} 스냅샷 여러 개를 모아 응대·결제·담당자별·재컨택·채널을 합산한다.
 * 날짜별 조회(드롭다운)는 스냅샷 하나를 그대로 보여주지만, 이 화면은 기간 전체를 하나의
 * 숫자로 요약해서 보여준다 — "이번주 응대는 몇 건인가"에 답하기 위함.
 *
 * 주/달 경계는 metrics3(진단 화면)와 같은 방식(ISO 주차, 달력 월)을 그대로 쓴다 —
 * 두 화면에서 같은 "이번주"가 다른 날짜 범위를 가리키면 혼란을 준다.
 *
 * 채널_일자별은 fetch-airtable.ts가 채널 필드를 정리해 저장한 시점부터 쌓이므로
 * 그 이전 스냅샷에는 없다 — 없는 날짜는 채널 합산에서 자연히 빠진다(집계 왜곡 방지를 위해
 * 별도 폴백을 두지 않는다).
 */
import { TOP_CHANNELS_COUNT } from '../constants';
import { toKST } from '../metrics/biz-date';
import { listPeriods, resolvePeriod, weekIdOf, monthIdOf } from '../metrics3/period';
import { DashboardV2, AssigneeMetric, DailyChannelCount } from './types';

export type TableKey = '인바운드' | 'skb' | '정보와기술' | '레드텔레콤_IB';
/** 이 화면은 주차별·월별만 다룬다(진단 화면의 'day'는 여기서 쓰지 않는다) */
export type PeriodKind = 'week' | 'month';

/**
 * kind(week/month) + period(생략 시 오늘이 속한 기간) → [시작, 끝].
 * 집계시작 이전으로는 내려가지 않는다.
 */
export function periodRange(
  kind: PeriodKind,
  period: string | null,
  집계시작: string
): { id: string; 시작: string; 끝: string; label: string } {
  const today = toKST(new Date());
  const id = period ?? (kind === 'week' ? weekIdOf(today) : monthIdOf(today));
  const r = resolvePeriod(kind, id);
  return {
    id: r.id,
    시작: r.시작 > 집계시작 ? r.시작 : 집계시작,
    끝: r.종료,
    label: r.label,
  };
}

/** 집계시작 이후, 선택 가능한 주차/월 목록 (최신순) */
export function listSelectablePeriods(kind: PeriodKind, 집계시작: string) {
  return listPeriods(kind, toKST(new Date()), 집계시작);
}

/**
 * 채널(UTM 소스) 1개의 기간 내 유입·결제.
 * 결제는 유입일 기준 코호트 전환 — 그 채널로 유입된 리드 중 결제ID에 매칭된 건수.
 * 결제 데이터 엑셀 대조가 없는 스냅샷만 있으면 결제·전환율_pct가 undefined/null이다.
 */
export interface ChannelPeriodStat {
  채널: string;
  유입: number;
  결제?: number;
  전환율_pct: number | null;
}

export interface PeriodSummary {
  기간: { 시작: string; 끝: string }; // 스냅샷이 있는 날짜 기준 (YYYY-MM-DD)
  일수: number; // 스냅샷이 존재하는 날짜 수
  응대: number;
  결제: number;
  전환율_pct: number | null;
  분해: { 결제: number; 실패: number; 중복문의: number; B2B: number; 미확정: number };
  재컨택: { 신규: number; 재컨택: number; 재컨택률_pct: number; 이력없음: boolean } | null;
  담당자별: AssigneeMetric[];
  유입: number;
  채널_Top: ChannelPeriodStat[];
}

function emptySummary(시작: string, 끝: string): PeriodSummary {
  return {
    기간: { 시작, 끝 },
    일수: 0,
    응대: 0,
    결제: 0,
    전환율_pct: null,
    분해: { 결제: 0, 실패: 0, 중복문의: 0, B2B: 0, 미확정: 0 },
    재컨택: null,
    담당자별: [],
    유입: 0,
    채널_Top: [],
  };
}

/**
 * 스냅샷 목록(기간 내) → 기간 합산 요약.
 *
 * @param snapshots 기간에 해당하는 v2:daily 스냅샷들 (날짜 무관 순서, 날짜 중복 없음 가정)
 * @param table 인바운드 / skb / 정보와기술 중 어느 테이블 지표를 합산할지
 * @param 시작 조회 기간 시작일 (표시용, 스냅샷 유무와 무관)
 * @param 끝 조회 기간 끝일 (표시용)
 */
export function summarizePeriod(
  snapshots: DashboardV2[],
  table: TableKey,
  시작: string,
  끝: string
): PeriodSummary {
  if (snapshots.length === 0) return emptySummary(시작, 끝);

  let 응대 = 0;
  let 결제 = 0;
  let 엑셀기준_존재 = false; // 기간 내 하루라도 엑셀 기준(전환율_pct === null)이면 응대·결제 모집단이 갈려 비율이 안 맞는다
  const 분해 = { 결제: 0, 실패: 0, 중복문의: 0, B2B: 0, 미확정: 0 };
  let 신규 = 0;
  let 재컨택 = 0;
  let 재컨택_존재 = false;
  let 이력없음_전체 = true;
  const 담당자맵 = new Map<string, { 응대: number; 결제: number }>();
  let 유입 = 0;
  const 채널맵 = new Map<string, { 유입: number; 결제: number }>();

  for (const s of snapshots) {
    const cur = s[table];
    // 정보와기술은 2026-09-23에 추가된 필드라 그 이전 스냅샷엔 없다 — 없는 날짜는 건너뛴다
    if (!cur) continue;
    const 전환 = cur.전환;
    응대 += 전환.응대;
    결제 += 전환.결제;
    if (전환.전환율_pct === null) 엑셀기준_존재 = true;
    분해.결제 += 전환.분해.결제;
    분해.실패 += 전환.분해.실패;
    분해.중복문의 += 전환.분해.중복문의;
    분해.B2B += 전환.분해.B2B;
    분해.미확정 += 전환.분해.미확정;

    if (전환.재컨택) {
      재컨택_존재 = true;
      신규 += 전환.재컨택.신규;
      재컨택 += 전환.재컨택.재컨택;
      if (!전환.재컨택.이력없음) 이력없음_전체 = false;
    }

    for (const a of cur.담당자별) {
      const e = 담당자맵.get(a.담당자) ?? { 응대: 0, 결제: 0 };
      e.응대 += a.응대;
      e.결제 += a.결제;
      담당자맵.set(a.담당자, e);
    }
  }

  // 유입_일자별·채널_일자별은 스냅샷마다 "집계시작 이후 전체"를 담고 있어(그날의 신규분이 아님)
  // 여러 스냅샷을 순회하며 더하면 같은 날짜가 여러 번 잡힌다. table이 존재하는 가장 최근
  // 스냅샷 하나에서만 기간 내 날짜를 걸러 합산해 중복을 막는다.
  const 최신 = [...snapshots]
    .filter((s) => !!s[table])
    .sort((a, b) => a.오늘.localeCompare(b.오늘))
    .at(-1);
  for (const d of 최신?.[table]?.유입_일자별 ?? []) {
    if (d.날짜 < 시작 || d.날짜 > 끝) continue;
    유입 += d.건수;
  }
  const 최신테이블 = 최신?.[table] as { 채널_일자별?: DailyChannelCount[] } | undefined;
  const 최신채널 = 최신테이블?.채널_일자별 ?? [];
  // 결제ID 대조가 있는 스냅샷과 없는 스냅샷이 기간 내에 섞일 수 있으므로(엑셀 기준 도입 전후),
  // 채널 하나라도 결제 필드가 undefined인 날짜가 있으면 그 채널의 결제 합산은 신뢰할 수 없다.
  const 채널결제불가 = new Set<string>();
  for (const c of 최신채널) {
    if (c.날짜 < 시작 || c.날짜 > 끝) continue;
    const e = 채널맵.get(c.채널) ?? { 유입: 0, 결제: 0 };
    e.유입 += c.건수;
    if (c.결제 === undefined) 채널결제불가.add(c.채널);
    else e.결제 += c.결제;
    채널맵.set(c.채널, e);
  }

  const 담당자별: AssigneeMetric[] = [...담당자맵.entries()]
    .map(([담당자, v]) => ({
      담당자,
      응대: v.응대,
      결제: v.결제,
      전환율_pct: 엑셀기준_존재 ? null : v.응대 > 0 ? Math.round((v.결제 / v.응대) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.응대 - a.응대);

  const 채널_Top: ChannelPeriodStat[] = [...채널맵.entries()]
    .sort((a, b) => b[1].유입 - a[1].유입)
    .slice(0, TOP_CHANNELS_COUNT)
    .map(([채널, v]) => {
      const 결제신뢰 = !채널결제불가.has(채널);
      return {
        채널,
        유입: v.유입,
        결제: 결제신뢰 ? v.결제 : undefined,
        전환율_pct: 결제신뢰 && v.유입 > 0 ? Math.round((v.결제 / v.유입) * 1000) / 10 : null,
      };
    });

  return {
    기간: { 시작, 끝 },
    일수: snapshots.length,
    응대,
    결제,
    전환율_pct: !엑셀기준_존재 && 응대 > 0 ? Math.round((결제 / 응대) * 1000) / 10 : null,
    분해,
    재컨택: 재컨택_존재
      ? {
          신규,
          재컨택,
          재컨택률_pct: 신규 + 재컨택 > 0 ? Math.round((재컨택 / (신규 + 재컨택)) * 1000) / 10 : 0,
          이력없음: 이력없음_전체,
        }
      : null,
    담당자별,
    유입,
    채널_Top,
  };
}

/**
 * 레드텔레콤 O/B 기간 요약 — 결제 건수만 있는 카운트 전용 소스라 PeriodSummary와 다른 모양이다.
 *
 * computeRedtelOB()가 세는 결제는 "그날 기준 [콜]최종 결과 == 결제 완료 전체 레코드 수"라
 * 날짜별 스냅샷을 그대로 더하면 같은 결제가 여러 날 중복 집계된다 — 레드재컨택과 같은 이유로
 * 기간과 무관하게 가장 최근 스냅샷 값을 그대로 쓴다.
 */
export interface RedtelOBPeriodSummary {
  기간: { 시작: string; 끝: string };
  일수: number;
  결제: number; // 전체 누적 (기간과 무관, 최신 스냅샷 값)
}

export function summarizeRedtelOB(
  snapshots: DashboardV2[],
  시작: string,
  끝: string
): RedtelOBPeriodSummary {
  // 레드텔레콤_OB는 이번 재편에서 추가된 필드라 그 이전 스냅샷엔 없다 — 있는 것 중 최신을 쓴다
  const 최신 = [...snapshots]
    .filter((s) => !!s.레드텔레콤_OB)
    .sort((a, b) => a.오늘.localeCompare(b.오늘))
    .at(-1);
  if (!최신) {
    return { 기간: { 시작, 끝 }, 일수: 0, 결제: 0 };
  }
  return { 기간: { 시작, 끝 }, 일수: snapshots.length, 결제: 최신.레드텔레콤_OB!.전환.결제 };
}

/**
 * compute_metrics.py의 TypeScript 포팅
 * 영업일 기준: 전날 20:00 KST ~ 당일 20:00 KST
 */
import { AirtableLead, AirtableHistory, AirtableMemo, HistEvent, MemoDatesByLead, MetricsResult } from '../types';
import { parseUTC, toKST, bizDate, prevDate } from './biz-date';
import { isSuccess, isFail, isAliveAt, processedDate } from './lead-status';
import { hadContactAction, hadContactActionInRange, hadMissedContactInRange, firstContactTs } from './actions';
import { computeLeadTimeStats } from './lead-time';
import { normalizeChannel } from './channel';
import { TOP_CHANNELS_COUNT } from '../constants';

/**
 * 메모관리 → 리드별 {영업일: 생성자} 매핑.
 * 생성자가 비어있는 메모는 시스템 자동/누락 케이스로 컨택에서 제외 (허수 방지).
 * 같은 리드·같은 영업일에 생성자 있는 메모 복수건이면 첫 메모의 생성자 사용.
 */
export function buildMemoDatesByLead(memoRecords: AirtableMemo[]): MemoDatesByLead {
  const map: MemoDatesByLead = new Map();
  for (const m of memoRecords) {
    const f = m.fields;
    const links = f.피추천인 || [];
    const created = parseUTC(f.Created);
    const creator = (f.생성자 || '').trim();
    if (!created || links.length === 0 || !creator) continue;
    const memoBiz = bizDate(toKST(created));
    for (const link of links) {
      if (!map.has(link)) map.set(link, new Map());
      const inner = map.get(link)!;
      if (!inner.has(memoBiz)) inner.set(memoBiz, creator);
    }
  }
  return map;
}

export function buildHistByLead(histRecords: AirtableHistory[]): Map<string, HistEvent[]> {
  const map = new Map<string, HistEvent[]>();
  for (const h of histRecords) {
    const f = h.fields;
    const links = f.피추천인 || [];
    const ts = parseUTC(f['Created time']);
    for (const link of links) {
      if (!map.has(link)) map.set(link, []);
      map.get(link)!.push({
        이력: f.이력 || '',
        변경필드: f['변경 필드값'] || '',
        ts,
      });
    }
  }
  // Sort by timestamp
  for (const [, events] of map) {
    events.sort((a, b) => {
      const ta = a.ts?.getTime() ?? 0;
      const tb = b.ts?.getTime() ?? 0;
      return ta - tb;
    });
  }
  return map;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeRange(
  startDate: string,
  endDate: string,
  leads: AirtableLead[],
  histByLead: Map<string, HistEvent[]>,
  memoDatesByLead?: MemoDatesByLead
): MetricsResult {
  const prevDateStr = prevDate(startDate);

  // 전화번호 키워드별 유입 시간 그룹핑 (중복 판정용)
  const byPhone = new Map<string, Date[]>();
  for (const l of leads) {
    const key = l.fields['전화번호 키워드'] || '';
    if (!key) continue;
    const ts = parseUTC(l.fields.유입시간);
    if (!ts) continue;
    if (!byPhone.has(key)) byPhone.set(key, []);
    byPhone.get(key)!.push(ts);
  }
  for (const [, times] of byPhone) {
    times.sort((a, b) => a.getTime() - b.getTime());
  }

  // --- 리드 관련 ---
  let startAlive = 0;
  const periodNewIds = new Set<string>();
  const periodNewDupIds = new Set<string>();
  let endAlive = 0;

  for (const l of leads) {
    const inflow = parseUTC(l.fields.유입시간);
    if (!inflow) continue;
    const inflowBiz = bizDate(toKST(inflow));

    // 시작 전 잔존
    if (inflowBiz <= prevDateStr && isAliveAt(l, histByLead, prevDateStr)) {
      startAlive++;
    }

    // 기간 신규
    if (inflowBiz >= startDate && inflowBiz <= endDate) {
      periodNewIds.add(l.id);
      const key = l.fields['전화번호 키워드'] || '';
      if (key) {
        const times = byPhone.get(key) || [];
        const hasEarlier = times.some(t => {
          if (!inflow || t >= inflow) return false;
          const tBiz = bizDate(toKST(t));
          return tBiz >= startDate && tBiz <= endDate;
        });
        if (hasEarlier) periodNewDupIds.add(l.id);
      }
    }

    // 마감 잔존
    if (inflowBiz <= endDate && isAliveAt(l, histByLead, endDate)) {
      endAlive++;
    }
  }

  const periodNew = periodNewIds.size;
  const periodNewDup = periodNewDupIds.size;
  const periodNewUnique = periodNew - periodNewDup;

  // --- 액션 관련 ---
  // 같은 사람(전화번호 뒷8자리)에게 여러 번 컨택해도 1건으로 카운트.
  // 전화번호가 없는 리드는 리드 ID로 폴백.
  const phoneKeyOf = (l: AirtableLead) =>
    l.fields['전화번호 키워드'] || `__nokey_${l.id}`;

  const todayContactedPhones = new Set<string>();
  const todayContactedNewPhones = new Set<string>();
  const todayContactedExistingPhones = new Set<string>();
  const todayContactedNewBurnPhones = new Set<string>();
  const todayMissedPhones = new Set<string>();
  const todaySuccessNewPhones = new Set<string>();
  const todaySuccessExistingPhones = new Set<string>();
  const todayFailPhones = new Set<string>();
  const todayFailDupPhones = new Set<string>();
  const allActionPhones = new Set<string>();

  for (const l of leads) {
    const lid = l.id;
    const pkey = phoneKeyOf(l);
    const final = l.fields['[콜]최종 결과'];
    const procD = processedDate(l, histByLead);
    const inflow = parseUTC(l.fields.유입시간);
    const inflowBiz = inflow ? bizDate(toKST(inflow)) : null;

    if (hadContactActionInRange(lid, histByLead, startDate, endDate, memoDatesByLead)) {
      todayContactedPhones.add(pkey);
      allActionPhones.add(pkey);
      if (periodNewIds.has(lid)) {
        todayContactedNewPhones.add(pkey);
      } else {
        todayContactedExistingPhones.add(pkey);
      }
    }

    if (hadMissedContactInRange(lid, histByLead, startDate, endDate)) {
      todayMissedPhones.add(pkey);
    }

    // 소진율: 고유 신규 중 유입 당일 컨택
    if (periodNewIds.has(lid) && !periodNewDupIds.has(lid) && inflowBiz) {
      if (hadContactAction(lid, histByLead, inflowBiz, memoDatesByLead)) {
        todayContactedNewBurnPhones.add(pkey);
      }
    }

    if (procD && procD >= startDate && procD <= endDate) {
      if (isSuccess(final)) {
        if (periodNewIds.has(lid)) {
          todaySuccessNewPhones.add(pkey);
        } else {
          todaySuccessExistingPhones.add(pkey);
        }
        allActionPhones.add(pkey);
      } else if (isFail(final)) {
        todayFailPhones.add(pkey);
        const failReason = l.fields['[콜]실패사유'] || '';
        if (periodNewDupIds.has(lid) || failReason.includes('중복')) {
          todayFailDupPhones.add(pkey);
        }
        allActionPhones.add(pkey);
      }
    }
  }

  const todayContacted = todayContactedPhones.size;
  const todayContactedFromNew = todayContactedNewBurnPhones.size;
  const todayContactedFromExisting = todayContactedExistingPhones.size;
  const todayMissed = todayMissedPhones.size;
  const todaySuccess = todaySuccessNewPhones.size + todaySuccessExistingPhones.size;
  const todaySuccessNew = todaySuccessNewPhones.size;
  const todaySuccessExisting = todaySuccessExistingPhones.size;
  const todayFail = todayFailPhones.size;
  const todayFailDup = todayFailDupPhones.size;
  const allActionIds = allActionPhones;

  // --- 지표 ---
  const denomConv = startAlive + periodNew;
  const convRate = denomConv ? (todaySuccess / denomConv) * 100 : 0;
  const burnRate = periodNewUnique ? (todayContactedFromNew / periodNewUnique) * 100 : 0;
  const missRate = todayContacted ? (todayMissed / todayContacted) * 100 : 0;
  const orderConvRate = todayContacted ? (todaySuccess / todayContacted) * 100 : 0;

  // --- 리드타임 ---
  const leadTimesMin: number[] = [];
  for (const l of leads) {
    if (!periodNewIds.has(l.id)) continue;
    const inflow = parseUTC(l.fields.유입시간);
    const firstTs = firstContactTs(l.id, histByLead);
    if (!inflow || !firstTs) continue;
    const delta = (firstTs.getTime() - inflow.getTime()) / 60000;
    if (delta >= 0) leadTimesMin.push(delta);
  }

  // --- 채널 분포 ---
  const chCounter = new Map<string, number>();
  for (const l of leads) {
    if (!periodNewIds.has(l.id)) continue;
    const ch = normalizeChannel(l.fields);
    chCounter.set(ch, (chCounter.get(ch) || 0) + 1);
  }
  const channelTop = [...chCounter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_CHANNELS_COUNT) as [string, number][];

  // --- 시간대별 분포 ---
  const hourlyInflow: Record<number, number> = {};
  for (const l of leads) {
    if (!periodNewIds.has(l.id)) continue;
    const inflow = parseUTC(l.fields.유입시간);
    if (inflow) {
      const hour = toKST(inflow).getHours();
      hourlyInflow[hour] = (hourlyInflow[hour] || 0) + 1;
    }
  }

  const hourlySuccess: Record<number, number> = {};
  const hourlyFail: Record<number, number> = {};
  for (const l of leads) {
    const lid = l.id;
    const final = l.fields['[콜]최종 결과'];
    const procD = processedDate(l, histByLead);
    if (!procD || procD < startDate || procD > endDate) continue;

    let procHour: number | null = null;
    const events = histByLead.get(lid) || [];
    for (let i = events.length - 1; i >= 0; i--) {
      const h = events[i];
      if (h.이력.includes('[상태변경]') && h.이력.includes('최종결과') && h.ts) {
        const kst = toKST(h.ts);
        if (bizDate(kst) === procD) {
          procHour = kst.getHours();
          break;
        }
      }
    }
    if (procHour !== null) {
      if (isSuccess(final)) {
        hourlySuccess[procHour] = (hourlySuccess[procHour] || 0) + 1;
      } else if (isFail(final)) {
        hourlyFail[procHour] = (hourlyFail[procHour] || 0) + 1;
      }
    }
  }

  return {
    대상기간: { start: startDate, end: endDate },
    리드: {
      전날잔존: startAlive,
      오늘신규: periodNew,
      오늘신규_중복: periodNewDup,
      오늘신규_고유: periodNewUnique,
      오늘잔존: endAlive,
    },
    액션: {
      오늘처리총량: allActionIds.size,
      오늘컨택: todayContacted,
      오늘컨택_신규: todayContactedFromNew,
      오늘컨택_기존팔로업: todayContactedFromExisting,
      오늘성공: todaySuccess,
      오늘성공_신규: todaySuccessNew,
      오늘성공_기존: todaySuccessExisting,
      오늘실패: todayFail,
      오늘실패_중복: todayFailDup,
      오늘부재: todayMissed,
    },
    지표: {
      전환율_pct: round2(convRate),
      전환율_분자: todaySuccess,
      전환율_분모: denomConv,
      소진율_pct: round2(burnRate),
      소진율_분자: todayContactedFromNew,
      소진율_분모: periodNewUnique,
      부재율_pct: round2(missRate),
      부재율_분자: todayMissed,
      부재율_분모: todayContacted,
      주문전환율_pct: round2(orderConvRate),
      주문전환율_분자: todaySuccess,
      주문전환율_분모: todayContacted,
    },
    리드타임: computeLeadTimeStats(leadTimesMin),
    채널_신규Top: channelTop,
    시간대별_유입: hourlyInflow,
    시간대별_성공: hourlySuccess,
    시간대별_실패: hourlyFail,
    _meta: {
      updatedAt: new Date().toISOString(),
      dataDate: endDate,
    },
  };
}

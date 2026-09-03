/**
 * 월 KPI 계산 — 목표를 영업일에 배분하고 실적과 대조한다.
 *
 * 공휴일은 `@hyunbinseo/holidays-kr`(관보 기준)에서 가져온다.
 * 하드코딩하지 않는 이유: 음력 기반 명절과 대체공휴일 규칙을 매년 손으로 넣으면
 * 조용히 틀리고, 틀리면 일 목표가 어긋난 채로 굴러간다.
 */
import { y2026, y2027 } from '@hyunbinseo/holidays-kr/all';
import { KpiDay, KpiMonth } from './types';

/** 연도별 공휴일 표 — 패키지가 커버하는 범위만 담는다 */
const HOLIDAYS: Record<string, Readonly<Record<string, readonly string[]>>> = {
  '2026': y2026,
  '2027': y2027,
};

/** 그날 공휴일 이름. 공휴일이 아니면 null */
export function holidayOf(날짜: string): string | null {
  const table = HOLIDAYS[날짜.slice(0, 4)];
  const names = table?.[날짜 as keyof typeof table];
  return names && names.length ? names.join('·') : null;
}

/** 주말(토·일)인지 */
function isWeekend(d: Date): boolean {
  const w = d.getDay();
  return w === 0 || w === 6;
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 그 달의 날짜 목록 (1일 ~ 말일) */
function daysOfMonth(월: string): { 날짜: string; date: Date }[] {
  const [y, m] = 월.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const out: { 날짜: string; date: Date }[] = [];
  for (let d = 1; d <= last; d++) out.push({ 날짜: ymd(y, m, d), date: new Date(y, m - 1, d) });
  return out;
}

/**
 * 월 KPI 계산.
 *
 * @param 월 'YYYY-MM'
 * @param 목표 월 목표 건수
 * @param 기준일 이 날짜까지의 실적만 유효로 본다 (YYYY-MM-DD)
 * @param 실적맵 날짜 → 결제 건수 (인바운드 + SKB 합산)
 */
export function computeKpi(
  월: string,
  목표: number,
  기준일: string,
  실적맵: Record<string, number>
): KpiMonth {
  const days = daysOfMonth(월);

  // 영업일 = 주말도 공휴일도 아닌 날
  const 영업일들 = days.filter((x) => !isWeekend(x.date) && holidayOf(x.날짜) === null);
  const 영업일수 = 영업일들.length;
  const 일목표 = 영업일수 > 0 ? 목표 / 영업일수 : 0;

  /*
   * 누적 목표는 소수점을 끌고 가다 마지막 영업일에 정확히 목표와 맞춘다.
   * 하루치를 반올림해서 더하면(31.5 → 32) 20일 뒤 목표가 640이 되어 10건 부풀려진다.
   */
  let 영업일카운트 = 0;
  let 누적실적 = 0;
  let 실적끊김 = false;

  const 일별: KpiDay[] = days.map((x) => {
    const 공휴일 = holidayOf(x.날짜);
    const 영업일 = !isWeekend(x.date) && 공휴일 === null;
    if (영업일) 영업일카운트++;

    // 기준일 이후는 실적이 없는 것으로 본다(미래). 주말도 실적은 세지만 목표는 0이다
    const 미래 = x.날짜 > 기준일;
    const 실적 = 미래 ? null : (실적맵[x.날짜] ?? 0);
    if (실적 === null) 실적끊김 = true;
    else if (!실적끊김) 누적실적 += 실적;

    const 목표당일 = 영업일 ? Math.round(일목표 * 10) / 10 : 0;
    return {
      날짜: x.날짜,
      요일: x.date.getDay(),
      영업일,
      공휴일,
      목표: 목표당일,
      실적,
      차이: 실적 === null ? null : Math.round((실적 - 목표당일) * 10) / 10,
      누적목표: Math.round(일목표 * 영업일카운트),
      누적실적: 실적 === null ? null : 누적실적,
    };
  });

  // 기준일까지의 누적
  const 기준까지 = 일별.filter((d) => d.날짜 <= 기준일);
  const 총누적실적 = 기준까지.reduce((s, d) => s + (d.실적 ?? 0), 0);
  const 지난영업일 = 기준까지.filter((d) => d.영업일).length;
  const 누적목표 = Math.round(일목표 * 지난영업일);

  const 잔여영업일 = 일별.filter((d) => d.영업일 && d.날짜 > 기준일).length;
  const 잔여 = 목표 - 총누적실적;
  // 일평균은 지난 영업일로 나눈다 — 주말 실적도 분자에 들어가므로 실제 속도를 반영한다
  const 일평균 = 지난영업일 > 0 ? 총누적실적 / 지난영업일 : 0;

  return {
    월,
    목표,
    영업일수,
    일목표: Math.round(일목표 * 10) / 10,
    기준일,
    누적실적: 총누적실적,
    누적목표,
    격차: 총누적실적 - 누적목표,
    잔여,
    잔여영업일,
    필요일평균: 잔여영업일 > 0 ? Math.round((잔여 / 잔여영업일) * 10) / 10 : null,
    달성률_pct: 목표 > 0 ? Math.round((총누적실적 / 목표) * 1000) / 10 : 0,
    예상착지: Math.round(일평균 * 영업일수),
    일별,
  };
}

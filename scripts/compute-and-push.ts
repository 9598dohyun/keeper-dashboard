/**
 * 로컬 JSON에서 인바운드·SKB·레드텔레콤 데이터를 읽고 v2 지표를 계산하여 Vercel KV에 저장
 * GitHub Actions에서 실행됨
 *
 * 응대: 메모수정시각이 '오늘'(KST) 기준 / 유입·채널: 유입시간 기준
 * 결제: 결제 데이터 엑셀 대조 결과(data/결제대조.json)가 있으면 그것을 진짜 소스로 쓴다.
 */
import fs from 'fs';
import path from 'path';
import { V2Record, DashboardV2, PaymentReconcile } from '../src/lib/metrics2/types';
import {
  computeInbound,
  computeSkb,
  computeRepPhone,
  computeRedtelIB,
  computeRedtelOB,
} from '../src/lib/metrics2/compute';
import {
  ContactHistory,
  updateHistory,
} from '../src/lib/metrics2/recontact';
import { formatDate, toKST } from '../src/lib/metrics/biz-date';
import { V2_AGGREGATE_START, KV_DAILY_TTL } from '../src/lib/constants';

const DATA_DIR = path.join(__dirname, '../data');
const KV_URL = process.env.KV_REST_API_URL!;
const KV_TOKEN = process.env.KV_REST_API_TOKEN!;

async function kvSet(key: string, value: unknown, exSeconds?: number) {
  const args: Array<string | number> = ['SET', key, JSON.stringify(value)];
  if (exSeconds) args.push('EX', exSeconds);

  const res = await fetch(`${KV_URL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });

  if (!res.ok) {
    throw new Error(`KV SET failed: ${res.status} ${await res.text()}`);
  }
}

async function kvGet<T>(key: string): Promise<T | null> {
  const res = await fetch(`${KV_URL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(['GET', key]),
  });

  if (!res.ok) {
    throw new Error(`KV GET failed: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as { result: string | null };
  if (json.result == null) return null;
  return JSON.parse(json.result) as T;
}

/**
 * 집계 대상일 (KST, YYYY-MM-DD)
 *
 * cron은 KST 23:59에 걸려 있으나 GitHub Actions가 스케줄을 수십 분 지연 실행하는 일이 잦다.
 * 그 결과 자정을 넘겨 실행되면 날짜가 바뀌어 "오늘 응대"가 0건인 빈 스냅샷이 저장된다
 * (2026-07-30~08-11 스냅샷 12건이 이 문제로 응대·결제 0으로 기록됨).
 *
 * 따라서 새벽(00:00~05:59)에 실행되면 전날을 마감 대상으로 본다.
 * 그 시간대 유입은 야간분이라 어차피 익영업일 처리되므로, 전날로 확정하는 편이 실제에 맞다.
 */
const LATE_RUN_CUTOFF_HOUR = 6;

function targetDateKST(): string {
  const kst = toKST(new Date());
  if (kst.getHours() < LATE_RUN_CUTOFF_HOUR) {
    kst.setDate(kst.getDate() - 1);
  }
  return formatDate(kst);
}

function load(name: string): V2Record[] {
  const p = path.join(DATA_DIR, name);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as V2Record[];
}

/**
 * 결제 데이터 엑셀 대조 결과. 없으면 null.
 *
 * 이 파일이 있으면 결제수는 엑셀 기준으로 계산된다(에어테이블 최종결과 무시).
 * scripts/payment-sync/reconcile.py 로 생성한다.
 */
function loadReconcile(): PaymentReconcile | null {
  const p = path.join(DATA_DIR, '결제대조.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as PaymentReconcile;
}

/**
 * 접촉이력 스냅샷 (리드ID → 마지막 접촉일).
 *
 * `메모수정시각`은 덮어쓰기 필드라 에어테이블만으로는 과거 접촉 여부를 알 수 없다.
 * 그래서 실행마다 이 파일에 누적해 두고 다음 실행에서 날짜가 바뀐 건을 재컨택으로 센다.
 * 파일이 없으면 첫 실행이므로 빈 이력으로 시작한다(그날은 전부 신규로 잡힌다).
 */
function 이력경로(name: string): string {
  return path.join(DATA_DIR, `접촉이력_${name}.json`);
}

function load이력(name: string): ContactHistory {
  const p = 이력경로(name);
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as ContactHistory;
}

function save이력(name: string, 이력: ContactHistory) {
  fs.writeFileSync(이력경로(name), JSON.stringify(이력), 'utf-8');
}

/** 그날 접촉된 리드의 [ID, 접촉일]. compute의 응대일 판정과 같은 기준을 쓴다 */
function 접촉목록(records: V2Record[], 오늘: string): [string, string][] {
  const out: [string, string][] = [];
  for (const r of records) {
    const ts = r.fields.메모수정시각;
    if (!ts) continue;
    const d = formatDate(toKST(new Date(ts)));
    if (d === 오늘) out.push([r.id, 오늘]);
  }
  return out;
}

async function main() {
  const 집계시작 = V2_AGGREGATE_START;
  let 오늘 = targetDateKST();

  const inboundRecords = load('인바운드.json');
  const skbRecords = load('SKB.json');
  const redtelIBRecords = load('레드텔레콤_IB.json');
  const redtelOBRecords = load('레드텔레콤_OB.json');
  const repRecords = load('정보와기술.json');

  const 대조 = loadReconcile();
  if (대조) {
    // 엑셀 기준일을 집계일로 삼는다.
    // 결제 엑셀은 전날 마감분을 다음날 아침에 받는 일이 흔해(8/27에 받은 파일에 8/26 주문),
    // 실행일로 스냅샷을 찍으면 8/26 결제가 8/27 칸에 들어간다.
    if (대조.기준일 !== 오늘) {
      console.log(`집계일을 엑셀 기준일에 맞춥니다: ${오늘} → ${대조.기준일}`);
      오늘 = 대조.기준일;
    }
    console.log(
      `결제 소스: 엑셀 ${대조.엑셀파일} (기준일 ${대조.기준일}, 결제 ${대조.결제_전체}건 중 매칭 ${대조.결제_매칭}건)`
    );
  } else {
    console.log('결제 소스: 에어테이블 [콜]최종 결과 (결제대조.json 없음)');
  }
  const 인바운드ID = 대조 ? new Set(대조.결제ID_인바운드) : null;
  const skbID = 대조 ? new Set(대조.결제ID_SKB) : null;
  const 정보와기술ID = 대조 ? new Set(대조.결제ID_정보와기술 ?? []) : null;
  // 채널_일자별(코호트 전환) 전용 — 원장 전체 누적(취소 제외).
  // 위 결제ID(그날 하루치)를 그대로 쓰면 과거에 유입돼 다른 날 결제된 건이 빠져
  // 채널별 결제 합이 실제보다 작게 나온다(2026-10-01 확인: 정보와기술 대표전화 09-28+09-29
  // 결제 2건 중 1건이 누락).
  const 인바운드채널결제ID = 대조?.원장_결제ID_인바운드 ? new Set(대조.원장_결제ID_인바운드) : 인바운드ID;
  const 정보와기술채널결제ID = 대조?.원장_결제ID_정보와기술
    ? new Set(대조.원장_결제ID_정보와기술)
    : 정보와기술ID;
  // 결제ID(레코드ID 집합)만으로 세면 같은 리드가 여러 주문(같은 날 재구매·증설 등)의 대표로
  // 뽑힐 때 집합 크기가 실제 주문 건수보다 작아진다 — 정확한 주문 단위 건수를 우선한다.
  const 인바운드결제건수 = 대조?.결제건수_인바운드;
  const skb결제건수 = 대조?.결제건수_SKB;
  const 정보와기술결제건수 = 대조?.결제건수_정보와기술;
  const 인바운드담당자별결제 = 대조?.담당자별_결제_인바운드;
  const skb담당자별결제 = 대조?.담당자별_결제_SKB;
  const 정보와기술담당자별결제 = 대조?.담당자별_결제_정보와기술;

  // 접촉이력은 인바운드/SKB/정보와기술가 서로 다른 베이스·테이블이라 ID 공간이 겹치지 않게 분리 저장한다.
  const 인바운드이력 = load이력('인바운드');
  const skb이력 = load이력('SKB');
  const 정보와기술이력 = load이력('정보와기술');

  const 인바운드 = computeInbound(
    inboundRecords,
    집계시작,
    오늘,
    인바운드ID,
    인바운드이력,
    인바운드결제건수,
    인바운드담당자별결제,
    인바운드채널결제ID
  );
  const skb = computeSkb(
    skbRecords,
    집계시작,
    오늘,
    skbID,
    skb이력,
    skb결제건수,
    skb담당자별결제
  );
  const 정보와기술 = computeRepPhone(
    repRecords,
    집계시작,
    오늘,
    정보와기술ID,
    정보와기술이력,
    정보와기술결제건수,
    정보와기술담당자별결제,
    정보와기술채널결제ID
  );
  const 레드텔레콤_IB = computeRedtelIB(redtelIBRecords, 집계시작, 오늘);
  const 레드텔레콤_OB = computeRedtelOB(redtelOBRecords);

  const updatedAt = new Date().toISOString();
  const dashboard: DashboardV2 = {
    인바운드,
    skb,
    레드텔레콤_IB,
    레드텔레콤_OB,
    정보와기술,
    집계시작,
    오늘,
    _meta: {
      updatedAt,
      counts: {
        인바운드: inboundRecords.length,
        skb: skbRecords.length,
        레드텔레콤_IB: redtelIBRecords.length,
        레드텔레콤_OB: redtelOBRecords.length,
        정보와기술: repRecords.length,
      },
      결제소스: 대조
        ? {
            종류: 'excel',
            엑셀파일: 대조.엑셀파일,
            기준일: 대조.기준일,
            미매칭_건수: 대조.미매칭_건수,
            에어테이블만_결제_건수: 대조.에어테이블만_결제_건수,
          }
        : { 종류: 'airtable' },
    },
  };

  await kvSet('v2:latest', dashboard);
  await kvSet('v2:meta', {
    updatedAt,
    집계시작,
    오늘,
    counts: dashboard._meta.counts,
  });

  // 날짜별 스냅샷 — 하루 1회(KST 23:59) 수집 시 그날 날짜로 확정 저장
  await kvSet(`v2:daily:${오늘}`, dashboard, KV_DAILY_TTL);

  // 저장된 날짜 목록 갱신 (내림차순 정렬, 중복 제거)
  const 기존날짜 = (await kvGet<string[]>('v2:dates')) ?? [];
  const 날짜목록 = Array.from(new Set([...기존날짜, 오늘])).sort().reverse();
  await kvSet('v2:dates', 날짜목록);

  // 접촉이력 갱신은 KV 저장이 끝난 뒤에 한다.
  // 먼저 저장하면 push가 실패했을 때 이력만 앞서가고, 다음 실행에서 그 접촉이
  // '이미 본 것'이 되어 재컨택으로 세지 못한다.
  save이력('인바운드', updateHistory(인바운드이력, 접촉목록(inboundRecords, 오늘)));
  save이력('SKB', updateHistory(skb이력, 접촉목록(skbRecords, 오늘)));
  save이력('정보와기술', updateHistory(정보와기술이력, 접촉목록(repRecords, 오늘)));

  console.log(`v2:daily:${오늘} 저장 완료 (누적 ${날짜목록.length}일)`);
  console.log('v2:latest 저장 완료');
  const 율 = (v: number | null) => (v === null ? '—' : `${v}%`);
  // 유입건수는 집계시작 이후 누적이다 (그날 유입은 유입_일자별에 있다)
  // 재컨택은 이력이 쌓인 뒤부터 의미가 있다 — 첫 실행은 전부 신규라 그 사실을 함께 찍는다
  const 재 = (c: typeof 인바운드.전환) =>
    !c.재컨택
      ? ''
      : c.재컨택.이력없음
        ? ` (신규 ${c.재컨택.신규} / 재컨택 ${c.재컨택.재컨택} — 이력 첫 수집일이라 전부 신규)`
        : ` (신규 ${c.재컨택.신규} / 재컨택 ${c.재컨택.재컨택} · ${c.재컨택.재컨택률_pct}%)`;
  console.log(
    `  인바운드: 오늘응대 ${인바운드.전환.응대}${재(인바운드.전환)} / 오늘결제 ${인바운드.전환.결제} / 전환율 ${율(인바운드.전환.전환율_pct)} / 누적유입 ${인바운드.유입건수}`
  );
  console.log(
    `  SKB: 오늘응대 ${skb.전환.응대}${재(skb.전환)} / 오늘결제 ${skb.전환.결제} / 전환율 ${율(skb.전환.전환율_pct)} / 누적유입 ${skb.유입건수}`
  );
  console.log(
    `  정보와기술: 오늘응대 ${정보와기술.전환.응대}${재(정보와기술.전환)} / 오늘결제 ${정보와기술.전환.결제} / 전환율 ${율(정보와기술.전환.전환율_pct)} / 누적유입 ${정보와기술.유입건수}`
  );
  console.log(
    `  레드텔레콤 I/B: 오늘응대 ${레드텔레콤_IB.전환.응대} / 오늘결제 ${레드텔레콤_IB.전환.결제} / 전환율 ${율(레드텔레콤_IB.전환.전환율_pct)} / 누적유입 ${레드텔레콤_IB.유입건수}`
  );
  console.log(`  레드텔레콤 O/B: 결제 ${레드텔레콤_OB.전환.결제}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

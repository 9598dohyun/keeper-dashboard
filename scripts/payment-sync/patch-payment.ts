/**
 * 과거 날짜 스냅샷의 "결제" 관련 필드만 다시 계산해 덮어쓴다.
 *
 * 배경: "취소(설치후)"를 결제 취소가 아니라 결제 인정으로 판정 기준을 바꿨다
 * (2026-09-30 확정 — 설치까지 끝난 뒤 취소된 것은 실질적으로 결제·서비스가 있었던 것으로 본다).
 * 이 기준으로 8/26~9/30 각 날짜의 결제건수를 다시 계산해야 하는데,
 * compute-and-push.ts를 그대로 재실행하면 응대·재컨택·유입 같은 다른 지표까지
 * (현재 시점 접촉이력·에어테이블 상태 기준으로) 덩달아 바뀌어 버린다.
 * 그래서 이 스크립트는 기존 v2:daily 스냅샷을 그대로 두고 결제 관련 필드만 교체한다.
 *
 * 사용법:
 *   단일 날짜 — data/결제대조.json 을 읽는다 (평소 하루치 절차와 같은 파일)
 *     python3 scripts/payment-sync/reconcile.py <엑셀> --date 2026-08-26
 *     npx tsx scripts/payment-sync/patch-payment.ts 2026-08-26
 *
 *   기간 일괄 — batch_reconcile.py가 쓴 data/결제대조_<날짜>.json 을 순회해 읽는다
 *     python3 scripts/payment-sync/batch_reconcile.py <엑셀> --start 2026-08-26 --end 2026-09-30
 *     npx tsx scripts/payment-sync/patch-payment.ts --start 2026-08-26 --end 2026-09-30
 *
 * 건드리는 필드: 인바운드/skb/정보와기술 각각의 전환.결제·전환.전환율_pct·전환.분해.결제·
 * 담당자별[].결제·담당자별[].전환율_pct. 응대·재컨택·유입·채널은 그대로 둔다.
 */
import fs from 'fs';
import path from 'path';
import {
  V2Record,
  DashboardV2,
  PaymentReconcile,
  ConversionMetrics,
  AssigneeMetric,
} from '../../src/lib/metrics2/types';

const DATA_DIR = path.join(__dirname, '../../data');
const KV_URL = process.env.KV_REST_API_URL!;
const KV_TOKEN = process.env.KV_REST_API_TOKEN!;

async function kvSet(key: string, value: unknown, exSeconds?: number) {
  const args: Array<string | number> = ['SET', key, JSON.stringify(value)];
  if (exSeconds) args.push('EX', exSeconds);
  const res = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`KV SET failed: ${res.status} ${await res.text()}`);
}

async function kvGet<T>(key: string): Promise<T | null> {
  const res = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['GET', key]),
  });
  if (!res.ok) throw new Error(`KV GET failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { result: string | null };
  if (json.result == null) return null;
  return JSON.parse(json.result) as T;
}

function load(name: string): V2Record[] {
  const p = path.join(DATA_DIR, name);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as V2Record[];
}

/** 응대일 = 메모수정시각 기준. compute.ts의 같은 이름 함수와 동일 정의 */
function 응대일(r: V2Record, 오늘: string): boolean {
  const ts = r.fields.메모수정시각 ?? r.fields['Last Modified'];
  if (!ts) return false;
  const d = new Date(ts);
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10) === 오늘;
}

/**
 * 기존 전환 객체에서 결제 관련 값만 새로 계산해 교체한다.
 * 응대·재컨택·분해의 결제 외 항목(실패·중복문의·B2B·미확정)은 그대로 둔다 —
 * 응대건 자체가 바뀌지 않았으니 그 분해도 결제로 넘어간 만큼만 실패에서 빼야 이치에 맞지만,
 * 이번 목적은 "결제건수 파악"이라 분해 재조정 없이 결제 숫자만 맞춘다.
 */
function patch전환(
  기존: ConversionMetrics,
  records: V2Record[],
  오늘: string,
  결제ID: Set<string>,
  결제건수: number
): ConversionMetrics {
  const 응대건 = records.filter((r) => 응대일(r, 오늘));
  const 분해결제 = 응대건.filter((r) => 결제ID.has(r.id)).length;
  return {
    ...기존,
    결제: 결제건수,
    // 엑셀 대조 기준이라 응대·결제 모집단이 달라 비율로 안 쓴다 — 기존과 동일하게 null 유지
    전환율_pct: null,
    분해: { ...기존.분해, 결제: 분해결제 },
  };
}

function patch담당자별(
  기존: AssigneeMetric[],
  담당자별결제: Record<string, number> | undefined
): AssigneeMetric[] {
  if (!담당자별결제) return 기존;
  const map = new Map(기존.map((a) => [a.담당자, { ...a }]));
  for (const [담당자, 결제] of Object.entries(담당자별결제)) {
    const cur = map.get(담당자) ?? { 담당자, 응대: 0, 결제: 0, 전환율_pct: null };
    cur.결제 = 결제;
    cur.전환율_pct = null;
    map.set(담당자, cur);
  }
  return [...map.values()];
}

function loadReconcile(날짜: string, 파일명: string): PaymentReconcile {
  const p = path.join(DATA_DIR, 파일명);
  if (!fs.existsSync(p)) {
    throw new Error(`${p} 가 없습니다.`);
  }
  const 대조 = JSON.parse(fs.readFileSync(p, 'utf-8')) as PaymentReconcile;
  if (대조.기준일 !== 날짜) {
    throw new Error(`${파일명} 기준일(${대조.기준일})이 요청한 날짜(${날짜})와 다릅니다.`);
  }
  return 대조;
}

async function patchOneDay(날짜: string, 대조: PaymentReconcile): Promise<void> {
  const 기존스냅샷 = await kvGet<DashboardV2>(`v2:daily:${날짜}`);
  if (!기존스냅샷) {
    console.log(`  ${날짜}: v2:daily 스냅샷이 없어 건너뜀 (TTL 만료 등)`);
    return;
  }

  const inboundRecords = load('인바운드.json');
  const skbRecords = load('SKB.json');
  const repRecords = load('정보와기술.json');

  const patched: DashboardV2 = {
    ...기존스냅샷,
    인바운드: 기존스냅샷.인바운드
      ? {
          ...기존스냅샷.인바운드,
          전환: patch전환(
            기존스냅샷.인바운드.전환,
            inboundRecords,
            날짜,
            new Set(대조.결제ID_인바운드),
            대조.결제건수_인바운드
          ),
          담당자별: patch담당자별(기존스냅샷.인바운드.담당자별, 대조.담당자별_결제_인바운드),
        }
      : 기존스냅샷.인바운드,
    skb: 기존스냅샷.skb
      ? {
          ...기존스냅샷.skb,
          전환: patch전환(
            기존스냅샷.skb.전환,
            skbRecords,
            날짜,
            new Set(대조.결제ID_SKB),
            대조.결제건수_SKB
          ),
          담당자별: patch담당자별(기존스냅샷.skb.담당자별, 대조.담당자별_결제_SKB),
        }
      : 기존스냅샷.skb,
    // 정보와기술은 2026-09-23에 추가된 필드라 그 이전 스냅샷엔 없다 — 없으면 손대지 않는다
    정보와기술: 기존스냅샷.정보와기술
      ? {
          ...기존스냅샷.정보와기술,
          전환: patch전환(
            기존스냅샷.정보와기술.전환,
            repRecords,
            날짜,
            new Set(대조.결제ID_정보와기술 ?? []),
            대조.결제건수_정보와기술
          ),
          담당자별: patch담당자별(
            기존스냅샷.정보와기술.담당자별,
            대조.담당자별_결제_정보와기술
          ),
        }
      : 기존스냅샷.정보와기술,
    _meta: {
      ...기존스냅샷._meta,
      결제소스: {
        종류: 'excel',
        엑셀파일: 대조.엑셀파일,
        기준일: 대조.기준일,
        미매칭_건수: 대조.미매칭_건수,
        에어테이블만_결제_건수: 대조.에어테이블만_결제_건수,
      },
    },
  };

  await kvSet(`v2:daily:${날짜}`, patched, 30 * 24 * 3600);

  const 결제표시 = (before: number | undefined, after: number | undefined) =>
    before === undefined ? '(없음)' : `${before}→${after}`;
  console.log(
    `  ${날짜}: 인바운드 ${결제표시(기존스냅샷.인바운드?.전환.결제, patched.인바운드?.전환.결제)} ` +
      `/ SKB ${결제표시(기존스냅샷.skb?.전환.결제, patched.skb?.전환.결제)} ` +
      `/ 정보와기술 ${결제표시(기존스냅샷.정보와기술?.전환.결제, patched.정보와기술?.전환.결제)}`
  );
}

function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  while (d <= e) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const startIdx = args.indexOf('--start');
  const endIdx = args.indexOf('--end');

  if (startIdx !== -1 && endIdx !== -1) {
    const start = args[startIdx + 1];
    const end = args[endIdx + 1];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      throw new Error('--start/--end 는 YYYY-MM-DD 형식이어야 합니다.');
    }
    const dates = dateRange(start, end);
    console.log(`${dates.length}일치 패치: ${start} ~ ${end}`);
    for (const 날짜 of dates) {
      const 대조 = loadReconcile(날짜, `결제대조_${날짜}.json`);
      await patchOneDay(날짜, 대조);
    }
    return;
  }

  const 날짜 = args[0];
  if (!날짜 || !/^\d{4}-\d{2}-\d{2}$/.test(날짜)) {
    throw new Error(
      '사용법: npx tsx scripts/payment-sync/patch-payment.ts YYYY-MM-DD\n' +
        '   또는: npx tsx scripts/payment-sync/patch-payment.ts --start YYYY-MM-DD --end YYYY-MM-DD'
    );
  }
  const 대조 = loadReconcile(날짜, '결제대조.json');
  await patchOneDay(날짜, 대조);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

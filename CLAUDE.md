# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important

This project uses **Next.js 16** which has breaking changes from earlier versions. Read `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Commands

```bash
npm run dev        # 로컬 개발 서버 (localhost:3000)
npm run build      # 프로덕션 빌드 (배포 전 라우트 생성/타입 검증용)
npm run lint       # ESLint 검사 (= eslint)
npx tsc --noEmit   # 타입체크 (별도 test 스위트 없음 — 빌드+타입체크가 검증 수단)

# 데이터 파이프라인 (로컬 수동 실행)
python3 scripts/payment-sync/reconcile.py <결제데이터.xlsx>  # 결제 엑셀 대조 → data/결제대조.json
npx tsx scripts/fetch-airtable.ts        # Airtable → data/*.json
npx tsx scripts/compute-and-push.ts      # 지표 계산 → Upstash KV 저장
```

**자동 스케줄은 2026-08-26에 중단했다.** 결제 데이터 엑셀을 오전에 받아 위 3단계로 수동
반영한다. 절차·트러블슈팅은 `scripts/payment-sync/README.md` 참조. 되살리려면 두 워크플로
(`refresh-metrics.yml`, `keeper-reports.yml`)의 `schedule` 블록 주석을 해제한다.

### v2 지표 기준 (2026-08-26 변경)

| 지표 | 기준 |
|------|------|
| 응대수 | `메모수정시각`이 그날인 건 — 메모 필드가 수정된 것을 응대로 본다 |
| 결제수 | **결제 데이터 엑셀**이 진짜 소스. 엑셀에 없으면 `[콜]최종 결과`가 '결제 완료'여도 세지 않는다 |
| 유입 | `유입시간` |

- 이전에는 응대를 `Last Modified`로 봤으나, 필드 아무거나 수정해도 갱신돼 일괄수정이 응대로
  잡혔다 (인바운드 8/21: 14:53 한 분에 1696건 일괄수정 → 응대 2482건, 유입은 106건).
  메모 필드만 감시하는 `메모수정시각`(에어테이블 오토메이션)으로 교체했다.
- 기준이 다른 `MEMO_TS_START`(2026-08-26) 이전 구간은 추이·유입 집계에서 제외한다.
- `data/결제대조.json`이 없으면 결제수가 에어테이블 기준으로 폴백한다.
- **진단 화면(metrics3)도 엑셀 기준**이다. `data/결제원장.json`(reconcile.py가 누적)에 쌓인
  결제건으로 판정하되, **원장이 덮는 기간에 유입된 리드만** 적용하고 그 이전은 에어테이블
  기준을 쓴다. 전체를 엑셀 기준으로 맞추려면 전체 기간 파일을 `--all` 로 한 번 넣으면 된다.
- 진단 조회 기간은 일간·주별(월~일)·월별. `d3:period:{kind}:{id}` 키에 저장된다.

환경변수 필요: `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `SK_AIRTABLE_TOKEN`, `SK_AIRTABLE_BASE_ID` (`.env.local`은 gitignore — 운영 환경은 Vercel 프로젝트 env에 별도 등록 필요)

## Architecture

이 앱은 **두 개의 독립된 기능**을 한 Next.js 프로젝트에 담고 있다.

1. **내부 대시보드** (`/dashboard`, `/guide`) — 에어테이블 CRM 데이터를 하루 1회(KST 23:59) 수집해 KPI를 표시하는 read-only 분석 화면. KV 캐시 기반.
2. **외부 리드 수집 랜딩** (`/cal`, `/cal/lead`, `/trial`, `/sk_lead`) — 고객 대상 공개 페이지. 폼 제출을 API Route가 받아 에어테이블에 **직접 write**한다 (KV 거치지 않음).

> **두 기능은 서로 다른 에어테이블 베이스를 쓴다 — 절대 혼동 금지.** 아래 "Airtable — 두 개의 베이스" 참조.

### 대시보드 파이프라인

한화비전 키퍼 인바운드 SDR 대시보드. 에어테이블 CRM 데이터를 하루 1회(KST 23:59, 마감 직전)로 수집하여 그날 날짜로 스냅샷을 저장하고 전환율·소진율·부재율 등 KPI를 표시한다. 대시보드에서 날짜 드롭다운으로 과거 스냅샷을 조회할 수 있다.

### Data Pipeline

```
GitHub Actions (하루 1회 cron: KST 23:59 = UTC 14:59)
  → scripts/fetch-airtable.ts: Airtable API → data/피추천인.json + data/이력관리.json
  → scripts/compute-and-push.ts: computeRange() → Upstash KV에 결과 저장

Next.js (Vercel)
  → /api/metrics (route.ts): KV에서 캐시된 결과 읽기 (<100ms)
  → /api/metrics?type=dates: 사용 가능한 날짜 목록 반환
  → /api/metrics?date=YYYY-MM-DD: 특정 날짜 데이터 조회
  → /api/metrics?type=weeks: 사용 가능한 주차 목록 반환
  → /api/metrics?type=weekly&week=YYYY-Www: 특정 주차 데이터 조회
  → Dashboard 컴포넌트: 일별/주별 토글 + 드롭다운으로 과거 데이터 조회
```

### Metrics Engine (`src/lib/metrics/`)

핵심 함수: `computeRange(startDate, endDate, leads, histByLead)` in `index.ts`

- **영업일 기준**: 전날 20:00 KST ~ 당일 20:00 KST (`biz-date.ts`)
- **리드 분류**: 성공(`결제 완료*`), 실패(`실패`), 활성(비어있음) (`lead-status.ts`)
- **액션 판정**: `[상태변경]` 이벤트 기반, `부재중:유입` 자동값 제외 (`actions.ts`)
- **리드타임**: 유입 → 첫 컨택 시간 차이, 중앙값·버킷 분포 (`lead-time.ts`)
- **채널 정규화**: `[참고]전체유입경로` 첫 세그먼트 / `진입경로` 폴백 (`channel.ts`)
- 이 로직은 Python 원본(`한화비전/분석/compute_metrics.py`)의 TypeScript 포팅이며, 두 결과가 일치해야 한다.

### KV Storage Keys

| Key | Content | TTL |
|-----|---------|-----|
| `metrics:daily:{YYYY-MM-DD}` | MetricsResult JSON | 30일 |
| `metrics:daily:latest` | 최신 일간 결과 | 없음 |
| `metrics:weekly:{YYYY-Www}` | MetricsResult JSON (주간 집계) | 196일 (28주) |
| `metrics:weekly:latest` | 최신 주간 결과 | 없음 |
| `metrics:trend:14d` | TrendEntry[] (14일분) | 1일 |
| `metrics:meta` | { lastUpdated, dataDate } | 없음 |
| `v2:latest` | DashboardV2 최신 스냅샷 (= 오늘) | 없음 |
| `v2:daily:{YYYY-MM-DD}` | DashboardV2 날짜별 스냅샷 (하루 1회 확정) | 30일 |
| `v2:dates` | 저장된 날짜 목록 (내림차순 string[]) | 없음 |
| `v2:meta` | { updatedAt, 집계시작, 오늘, counts } | 없음 |

### Airtable — 두 개의 베이스 (혼동 시 422 에러 / 잘못된 베이스 저장)

| 용도 | 베이스 | env | 테이블 | 주요 필드 |
|------|--------|-----|--------|----------|
| 대시보드 + `/cal`·`/trial` 리드 | 한화비전-키퍼 (`app0jJrNlgdkRmlIZ`) | `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID` | 피추천인 `tbl45D05oiu3wffTT`, 이력관리 `tblEPutPIjLYcm0Lp` | `피추천인이름`, `진입경로`, `UTM_source` |
| `/sk_lead` 리드 (SK브로드밴드 종료고객) | SK브로드밴드 통합관리 (`appa2Foo0JnvfPmlp`) | `SK_AIRTABLE_TOKEN`, `SK_AIRTABLE_BASE_ID` | 고객 `tbl45D05oiu3wffTT` | `이름`, `연락처`, `개인정보 수집동의`(checkbox), `UTM_source`, `페이지경로` |

- **테이블 ID(`tbl45D05oiu3wffTT`)가 우연히 같지만 베이스도 필드명도 다르다.** `/api/lead`는 `피추천인이름`을, `/api/sk-lead`는 `이름`을 쓴다. 한쪽 필드명을 다른 라우트에 넣으면 422.
- 대시보드 파이프라인은 **피추천인** + **이력관리** 두 테이블만 fetch (개인정보 제외, 계산용 필드만). SK 베이스는 리드 write 전용 — 대시보드와 무관.
- `UTM_source`는 singleSelect — 새 옵션(`sk-lead-page` 등)은 `typecast: true`로 자동 생성.

## Lead Capture (외부 공개 페이지)

| 라우트 | 파일 | 제출 → API | 저장 베이스 |
|--------|------|-----------|------------|
| `/cal` | `cal/cal-landing.tsx` | (소개+계산기, 폼은 `/cal/lead`로 이동) | — |
| `/cal/lead` | `cal/lead/lead-form.tsx` | `/api/lead` (`source: 'cal'`) | 한화비전-키퍼 |
| `/trial` | `trial/trial-landing.tsx` | `/api/lead` (`source: 'trial'`) | 한화비전-키퍼 |
| `/sk_lead` | `sk_lead/sk-lead-form.tsx` | `/api/sk-lead` | SK브로드밴드 |

- `/cal/lead`·`/trial`은 **공유 라우트 `/api/lead`** 를 쓰며 `source`로 분기(`피추천인이름`/`진입경로`/`UTM_source` 세팅). `/cal/lead`·`/trial` 폼을 고칠 땐 `/api/lead` 한 곳이 둘 다 영향.
- `/sk_lead`는 **전용 라우트 `/api/sk-lead`** — SK 베이스 구조에 맞춰 분리됨. cal/trial과 코드·env를 섞지 말 것.
- 리드 폼은 클라이언트 컴포넌트(`'use client'`), 페이지(`page.tsx`)는 metadata만 가진 서버 컴포넌트 래퍼. 스타일은 `cal/cal.css`(CSS 변수 정의) + 페이지별 css를 상대경로로 import.
- 폼 검증을 바꿀 땐 **클라이언트(폼)와 서버(route.ts) 양쪽**을 같이 고칠 것 — 서버가 최종 게이트.

## File Index

### scripts/ — 데이터 파이프라인 (GitHub Actions에서 실행)

| 파일 | 역할 |
|------|------|
| `fetch-airtable.ts` | Airtable API → data/피추천인.json + data/이력관리.json (개인정보 제외) |
| `compute-and-push.ts` | JSON → 지표 계산 → Vercel KV 저장 (일간 7일TTL + 14일 추이 + 메타) |
| `keeper-reports/` | **별도 Python 리포트 파이프라인** (위 TS 대시보드와 무관) — 구글 시트용 일/주/월 리포트 생성. `compute_metrics.py`(TS `metrics/index.ts`의 원본), `push_to_sheets.py`, `fetch_snapshot.py`, `requirements.txt` |

### src/lib/ — 핵심 로직

| 파일 | 역할 |
|------|------|
| `types.ts` | 전체 TypeScript 인터페이스 (MetricsResult, AirtableLead, TrendEntry 등) |
| `utils.ts` | Tailwind CSS 클래스 병합 유틸 |
| `metrics/index.ts` | **메트릭 계산 엔진** — `computeRange()`, `buildHistByLead()` |
| `metrics/biz-date.ts` | 영업일 계산 (전날 20:00~당일 20:00 KST), 날짜 포맷팅 |
| `metrics/lead-status.ts` | 리드 상태 판정 — 성공/실패/활성 분류, 처리 날짜 계산 |
| `metrics/actions.ts` | 상태변경 이벤트 분석 — 컨택/부재중/첫접촉 시간 판정 |
| `metrics/lead-time.ts` | 리드타임 통계 — 중앙값/평균/버킷별 분포 |
| `metrics/channel.ts` | 유입 채널 정규화 — 전체유입경로/진입경로 필드 추출 |
| `metrics/page.ts` | 랜딩 페이지 경로 정규화 — `진입경로` 우선, `[참고]전체유입경로` 폴백 (`/api/metrics?type=page-trend`가 의존) |

### src/app/api/ — 백엔드 API

| 파일 | 역할 |
|------|------|
| `metrics/route.ts` | GET /api/metrics — KV 조회. `type=` 으로 분기: `daily`(기본)·`weekly`·`monthly`·`all`·`meta`·`dates`/`weeks`/`months`(목록)·`trend`(14d)·`hourly-heatmap`·`channel-trend`/`assignee-trend`/`page-trend`(period=daily/weekly/monthly). `?date=`·`?week=`·`?month=`로 특정 기간 조회 |
| `lead/route.ts` | POST /api/lead — `/cal/lead`·`/trial` 폼 수신 → 한화비전-키퍼 베이스에 write (`source`로 분기) |
| `sk-lead/route.ts` | POST /api/sk-lead — `/sk_lead` 폼 수신 → SK브로드밴드 베이스에 write |

### src/app/components/ — 대시보드 UI

| 파일 | 역할 |
|------|------|
| `dashboard.tsx` | **메인 컴포넌트** — 데이터 페칭, 날짜 선택 드롭다운, 하위 컴포넌트 조합 |
| `lead-status-card.tsx` | 리드 현황 카드 — 전날잔존/오늘신규(고유·중복)/오늘잔존 |
| `action-status-card.tsx` | 액션 현황 카드 — 컨택/성공/실패/부재중 건수 |
| `kpi-gauges.tsx` | KPI 게이지 — 전환율/소진율/부재율 + 계산식(분자/분모) |
| `lead-time-chart.tsx` | 리드타임 분포 바 차트 — 6개 버킷별 건수 |
| `channel-chart.tsx` | 채널별 신규 리드 Top 10 가로 바 차트 |
| `hourly-chart.tsx` | 시간대별(0~23시) 유입/성공/실패 분포 |
| `trend-chart.tsx` | 14일 추이 라인 차트 — 전환율/소진율/부재율 + 건수 추이 |
| `metric-card.tsx` | 범용 메트릭 카드 (제목/값/부제/색상) |
| `nav-tabs.tsx` | 페이지 네비게이션 — "상담 가이드" / "대시보드" 링크 |

### src/app/ — 페이지

| 파일 | 역할 |
|------|------|
| `layout.tsx` | 루트 레이아웃 — 메타데이터, 글꼴, 전역 CSS |
| `page.tsx` | `/` 홈 — 상담 가이드 렌더링 |
| `dashboard/page.tsx` | `/dashboard` — Dashboard 컴포넌트 래퍼 |
| `guide/page.tsx` | `/guide` — 가이드 페이지 래퍼 |
| `guide/guide-content.tsx` | 상담 가이드 콘텐츠 — 7개 탭(운영룰, 가격, 스펙, 경쟁사, 응대, 에어테이블, 전화상담) |
| `cal/`, `trial/`, `sk_lead/` | 외부 리드 수집 랜딩 (위 "Lead Capture" 섹션 참조) |

### src/components/ui/ — shadcn 기반 UI 프리미티브

| 파일 | 역할 |
|------|------|
| `badge.tsx` | 배지 (variant: default/secondary/destructive) |
| `button.tsx` | 버튼 (variant/size 조합) |
| `card.tsx` | 카드 (Card/CardHeader/CardTitle/CardContent/CardFooter) |
| `select.tsx` | Select 드롭다운 (base-ui 기반) |
| `separator.tsx` | 구분선 (가로/세로) |

## Key Constraints

- Vercel Hobby 무료 플랜: 서버리스 함수 10초 제한 → API Route에서 Airtable 직접 fetch 불가, KV 캐시 필수
- Airtable API: rate limit 5 req/sec, pageSize 최대 100
- 개인정보(이름, 연락처) 절대 fetch/노출 금지
- `@/*` path alias → `./src/*` (tsconfig.json)

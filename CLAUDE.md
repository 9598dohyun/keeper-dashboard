# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important

This project uses **Next.js 16** which has breaking changes from earlier versions. Read `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Commands

```bash
npm run dev        # 로컬 개발 서버 (localhost:3000)
npm run build      # 프로덕션 빌드
npm run lint       # ESLint 검사

# 데이터 파이프라인 (로컬 수동 실행)
npx tsx scripts/fetch-airtable.ts        # Airtable → data/*.json
npx tsx scripts/compute-and-push.ts      # 지표 계산 → Upstash KV 저장
```

환경변수 필요: `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`

## Architecture

한화비전 키퍼 인바운드 SDR 대시보드. 에어테이블 CRM 데이터를 12시간 단위(07:59, 19:59 KST)로 수집하여 전환율·소진율·부재율 등 KPI를 표시한다.

### Data Pipeline

```
GitHub Actions (12시간 단위 cron: KST 07:59, 19:59)
  → scripts/fetch-airtable.ts: Airtable API → data/피추천인.json + data/이력관리.json
  → scripts/compute-and-push.ts: computeRange() → Upstash KV에 결과 저장

Next.js (Vercel)
  → /api/metrics (route.ts): KV에서 캐시된 결과 읽기 (<100ms)
  → /api/metrics?type=dates: 사용 가능한 날짜 목록 반환
  → /api/metrics?date=YYYY-MM-DD: 특정 날짜 데이터 조회
  → Dashboard 컴포넌트: 날짜 선택 드롭다운으로 과거 데이터 조회 가능
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
| `metrics:daily:{YYYY-MM-DD}` | MetricsResult JSON | 7일 |
| `metrics:daily:latest` | 최신 일간 결과 | 없음 |
| `metrics:trend:14d` | TrendEntry[] (14일분) | 1일 |
| `metrics:meta` | { lastUpdated, dataDate } | 없음 |

### Airtable Tables

- **피추천인** (`tbl45D05oiu3wffTT`): 리드 마스터. 계산에 쓰는 필드만 fetch (개인정보 제외)
- **이력관리** (`tblEPutPIjLYcm0Lp`): 상태 변경 이벤트 로그

## File Index

### scripts/ — 데이터 파이프라인 (GitHub Actions에서 실행)

| 파일 | 역할 |
|------|------|
| `fetch-airtable.ts` | Airtable API → data/피추천인.json + data/이력관리.json (개인정보 제외) |
| `compute-and-push.ts` | JSON → 지표 계산 → Vercel KV 저장 (일간 7일TTL + 14일 추이 + 메타) |

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

### src/app/api/ — 백엔드 API

| 파일 | 역할 |
|------|------|
| `metrics/route.ts` | GET /api/metrics — KV 조회 (type=dates/trend/daily, ?date=YYYY-MM-DD) |

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

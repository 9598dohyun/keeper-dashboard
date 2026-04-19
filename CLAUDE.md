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

한화비전 키퍼 인바운드 SDR 실시간 대시보드. 에어테이블 CRM 데이터를 15분 간격으로 수집하여 전환율·소진율·부재율 등 KPI를 표시한다.

### Data Pipeline

```
GitHub Actions (15분 cron, 영업시간)
  → scripts/fetch-airtable.ts: Airtable API → data/피추천인.json + data/이력관리.json
  → scripts/compute-and-push.ts: computeRange() → Upstash KV에 결과 저장

Next.js (Vercel)
  → /api/metrics (route.ts): KV에서 캐시된 결과 읽기 (<100ms)
  → Dashboard 컴포넌트: 5분마다 자동 폴링
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

## Key Constraints

- Vercel Hobby 무료 플랜: 서버리스 함수 10초 제한 → API Route에서 Airtable 직접 fetch 불가, KV 캐시 필수
- Airtable API: rate limit 5 req/sec, pageSize 최대 100
- 개인정보(이름, 연락처) 절대 fetch/노출 금지
- `@/*` path alias → `./src/*` (tsconfig.json)

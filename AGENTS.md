# AGENTS.md — Claude Code 에이전트 활용 가이드

## 사용 가능한 서브에이전트

| 에이전트 | 용도 | 언제 사용 |
|---------|------|----------|
| **Explore** | 코드베이스 탐색·검색 | 파일 구조 파악, 특정 함수/패턴 찾기, 의존관계 추적 |
| **Plan** | 구현 계획 설계 | 기능 추가·리팩토링 전 아키텍처 검토, 작업 범위 산정 |
| **general-purpose** | 범용 멀티스텝 작업 | 복합 검색, 데이터 분석, 여러 파일 교차 조사 |
| **vercel:ai-architect** | AI 기능 설계 | AI SDK 패턴, 프로바이더 설정, MCP 서버 연동 |
| **vercel:deployment-expert** | 배포·CI/CD | Vercel 배포 트러블슈팅, GitHub Actions, 환경변수 |
| **vercel:performance-optimizer** | 성능 최적화 | Core Web Vitals, 캐싱, 번들 사이즈, 렌더링 전략 |

## 에이전트 활용 원칙

- **단순 검색**은 Glob/Grep 직접 사용 (에이전트 불필요)
- **병렬 가능한 독립 작업**은 여러 에이전트 동시 실행
- **CLAUDE.md의 File Index를 먼저 확인** → 에이전트 없이 바로 접근 가능한 경우가 많음
- 코드 수정은 에이전트가 아닌 메인 컨텍스트에서 직접 수행

## Next.js 16 주의사항

이 프로젝트는 **Next.js 16**을 사용하며 기존 버전과 호환되지 않는 변경사항이 있음.
코드 작성 전 `node_modules/next/dist/docs/`를 확인할 것.

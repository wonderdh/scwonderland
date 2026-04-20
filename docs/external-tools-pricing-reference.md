# 외부 도구 도입 계획 (보류)

> 2026-04-20 정리. Sentry/Analytics/Jest/Playwright/Cache Components 기능·요금 요약. 도입 결정 시 참고.

## 1. Sentry — 에러 자동 추적

### 기능
- 서버/클라이언트 에러 자동 수집 (스택트레이스, 사용자 정보, URL, 브라우저)
- 핵심 Server Action에 트랜잭션 스팬 마킹 → 느린 쿼리 추적
- 사용자가 버그 신고 안 해도 터진 걸 먼저 인지

### 대상 액션
- `upsertReportCard` (report-actions)
- `bulkRecordAttendance` (attendance-actions)
- `getDailyBusManifest` (bus-actions)

### 요금
| 플랜 | 가격 | 제공량 |
|------|------|--------|
| **Developer (무료)** | $0 | 5K 에러/월, 10K 퍼포먼스 이벤트, 30일 보관, 1명 |
| Team | $26/월~ | 50K 에러, 다인원 |

학원 규모(학생 100명, 교사 15명) 기준 **무료 플랜으로 충분**.

### 도입 절차
1. Sentry 계정 생성 + DSN 발급
2. `npm install @sentry/nextjs` + `npx @sentry/wizard@latest -i nextjs`
3. 환경변수: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`
4. 핵심 액션 3개에 `Sentry.startSpan` 래핑

**가이드:** `docs/observability-setup.md`

---

## 2. Vercel Analytics + Speed Insights — 방문자·성능 분석

### 기능
- **Analytics:** 페이지별 방문자 수, 트래픽 패턴, 유저 플로우
- **Speed Insights:** 실제 사용자 체감 속도 (LCP, INP, CLS) — Core Web Vitals 트렌드

### 요금
| 플랜 | Analytics | Speed Insights |
|------|-----------|----------------|
| **Hobby (무료)** | 2,500 이벤트/월 | 10K data points/월 |
| Pro ($20/월) | 25K + $0.40/1K 추가 | 무제한 |

**주의:** 공개 사이트 방문자 많아지면 2,500 이벤트 금방 소진. 현재 트래픽 관찰 후 결정.

### 도입 절차
1. `npm install @vercel/analytics @vercel/speed-insights`
2. `src/app/layout.tsx`에 `<Analytics />`, `<SpeedInsights />` 추가
3. Vercel dashboard → 프로젝트 → Analytics 탭 활성화

**외부 계정 불필요 (이미 Vercel 사용 중이면 즉시 가능)**

---

## 3. Jest + Playwright — 자동 테스트

### 기능
- **Jest (단위):** `date-kst`, `student-sort`, `formatStudentName` 등 유틸 함수 자동 검증
- **Playwright (E2E):** 실제 브라우저에서 로그인 → 숙제 제출 같은 전체 플로우 자동 재생
- 리팩토링·기능 추가 시 기존 기능 회귀 자동 감지

### 요금
- **100% 무료** (Meta MIT / Microsoft Apache 2.0 오픈소스)
- CI 연동 시 GitHub Actions 무료 할당량(월 2,000분) 사용
- 테스트 1회 5분 기준 월 400회 가능 → 충분

### 도입 절차 (2단계 권장)

**1단계 — 즉시 가능:**
- Jest 설치 + `date-kst.test.ts`, `student-sort.test.ts` 단위 테스트 작성
- 외부 리소스 불필요

**2단계 — staging Supabase 필요:**
- `schedule-actions` 같은 integration 테스트
- Playwright E2E (학생 로그인 플로우)
- 테스트 계정 시딩 스크립트
- `TEST_STUDENT_ID`, `TEST_STUDENT_PW` 환경변수

**가이드:** `docs/test-infrastructure-setup.md`

---

## 4. Cache Components (Next.js 16) — 마스터 데이터 캐싱

### 기능
- 거의 안 바뀌는 마스터 데이터(`listBusNumbers`, `listBusTimeSlots`, `listBusStops`, `listTextbooks`)를 캐시
- 태그 기반 무효화: mutation 시 `revalidateTag("bus-master")` 한 번으로 정확히 갱신
- DB 쿼리 감소 → 응답 속도 향상 + Vercel Function 실행비 감소

### 효과 예상
- 버스 대시보드: ~400ms → ~150ms (마스터 데이터 3개 캐시 히트)
- 관리자 10명 동시 접속 시 DB 쿼리 40개 → 10개

### 요금
- **무료** (Next.js 16 내장 기능)
- Vercel Data Cache는 Hobby 포함 무제한 reads/writes
- **오히려 비용 절감** (DB·Function 사용 감소)

### 도입 조건 (🔴 staging 필수)
- 전역 플래그 `cacheComponents: true` 활성화 시 모든 페이지 Partial Prerendering 전환
- `cookies()`/`headers()`/`searchParams` 쓰는 Server Component는 `<Suspense>` 경계 필요
- 전체 페이지 회귀 테스트 후 prod 적용

### 선행 작업
1. staging 환경 준비
2. Suspense 경계 확장 (교사·관리자 dashboard — 현재 학생만 완료)
3. 마스터 액션 4개에 `"use cache"` + `cacheTag` 추가
4. Mutation 액션에 `revalidateTag` 추가

**가이드:** `docs/cache-components-setup.md`

---

## 💰 요금 시나리오 요약

| 시나리오 | 구성 | 월 요금 |
|---------|------|--------|
| A. 최소 시작 | Sentry 무료 + Vercel Hobby + Jest | **$0** |
| B. 트래픽 증가 시 | Sentry 무료 + Vercel Pro | **$20** (~27,000원) |
| C. 에러 많아지면 | Sentry Team + Vercel Pro | **$46** (~62,000원) |

**현 시점 권장:** 당분간 $0 플랜으로 충분. Vercel Analytics 이벤트 모니터링하다 넘치면 Pro 전환.

---

## 🎯 도입 우선순위 (재정리)

1. **Sentry (무료)** — 운영 중이면 즉시. 에러 잡는 게 최우선
2. **Vercel Analytics (무료)** — 5분이면 설치. 트래픽 파악
3. **Jest 단위 테스트** — staging 없이도 유틸 함수부터 시작 가능
4. **Playwright E2E** — staging Supabase 준비 후
5. **Cache Components** — Suspense 확장 + staging 회귀 테스트 후

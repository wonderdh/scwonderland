# SC Wonderland Plans.md

작성일: 2026-04-01

---

## Phase 1: 리포트카드 기능 개선

| Task | 내용 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 1.1 | 학생 답글 빈 문자열 → null 정규화 | `reply.trim() === ""` 시 null 저장, 학생 포털에서 "답글 없음" 상태 정상 표시 | - | cc:완료 (이미 구현됨) |
| 1.2 | 교사 대시보드 이번 달 리포트 작성 현황 배지 | 각 반 카드에 "N/M명 작성" 배지 표시, 미작성 시 amber·완료 시 green | 1.1 | cc:완료 |
| 1.3 | 관리자 — 반별 리포트카드 전체 현황 페이지 | `/admin/reports` 페이지 존재, 반·월별 작성률 테이블 표시, 네비게이션 메뉴 추가 | 1.2 | cc:완료 |

---

## Phase 2: 성능 최적화 — N+1 쿼리 제거 (즉각 효과)

> **목표:** 쿼리 수 대폭 감소로 서버 응답 속도 개선. 특히 리포트·버스·시간표 페이지.

| Task | 내용 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 2.1 | `listAllClassesReportStatus` N+1 → JOIN 단일 쿼리 | `report-actions.ts`: 반 25개 기준 51쿼리 → 1쿼리. Supabase `execute_sql` or 중첩 select 활용. 리포트 현황 페이지 정상 표시 확인 | - | cc:완료 |
| 2.2 | `listUsersByRole` — `auth.admin.listUsers(perPage:1000)` 제거 | `user-actions.ts`: profiles에 `email TEXT` 컬럼 추가 + DB 트리거로 Auth 이메일 자동 동기화. listUsers 호출 제거 후 학생·교사 관리 페이지 정상 표시 확인 | - | cc:완료 |
| 2.3 | `getGroupTimetableGrid` — 중복 교사 쿼리 합치기 | `schedule-actions.ts`: 현재 profiles→teachers 2단계(2쿼리) → `teachers JOIN profiles` 단일 쿼리로 교체. 시간표 페이지 정상 표시 확인 | - | cc:완료 |
| 2.4 | `getDailyBusManifest` Phase 2 쿼리 최적화 | `bus-actions.ts`: afterschoolOnlyIds 이미 필터링됨 — 추가 최적화 불필요 | - | cc:SKIP |

---

## Phase 3: 성능 최적화 — loading.tsx 스켈레톤 (체감 속도 개선)

> **목표:** 페이지 진입 시 Next.js `loading.tsx`로 즉시 스켈레톤 표시. 복잡한 Suspense 리팩터 없이 고효과.
> Client Component 아키텍처상 Suspense 분리 불가한 페이지들에 loading.tsx가 최적.

| Task | 내용 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 3.5 | 공통 Skeleton 컴포넌트 | `components/skeletons/` — SkeletonList, SkeletonTable, AdminListPageSkeleton, AdminDashboardSkeleton 이미 존재. 추가 작업 불필요 | - | cc:완료 |
| 3.1 | `admin/reports`, `bus-monitor` — loading.tsx 추가 | 나머지 라우트는 이미 loading.tsx 보유. admin/reports + bus-monitor 2개 신규 추가 완료 | 3.5 | cc:완료 |

# 2026-04-20 작업 핸드오프

> **플랜:** `C:\Users\wonde\.claude\plans\humble-whistling-pebble.md` (2026-04-18 작성된 4주 sprint 로드맵)
> **작업 기간:** 2026-04-20 (한 세션, Week 1~4 완료)
> **원칙:** 안전한 코드 변경만 수행. DB 마이그레이션 적용·외부 계정 필요 작업은 파일/문서만 작성.

---

## 완료된 작업 (커밋 대기 중, 아직 push 안 됨)

### Week 1 — P0 즉각 효과 큰 항목

| ID | 내용 | 파일 |
|----|------|------|
| 4.5 | `"use server"` 파일에서 `export type` 제거 | 이미 clean 상태 (plan 작성 시점 대비 선행 처리돼있었음) |
| 1.1 | SkeletonBone 중앙화 — 11곳 Bone 중복 제거 | `components/skeletons/SkeletonBone.tsx` 신규 + 7개 loading.tsx + 4개 skeleton 리팩토링 |
| 1.2 | loading.tsx ↔ 실제 페이지 구조 일치 | `AdminListPageSkeleton.tsx`(4탭 추가), `academy/student/loading.tsx`(위젯 3종), `academy/teacher/loading.tsx`(반 카드 그리드) |
| 2.1 | auth-helpers React `cache()` 적용 | `app/(admin)/admin/actions/auth-helpers.ts` — 요청당 1회만 DB 조회 |
| 2.2 | DB 핫 인덱스 마이그레이션 파일 작성 | `supabase/migrations/20260418000000_add_hot_indexes.sql` (5개 신규 인덱스) — **Supabase에 적용 안 됨** |

### Week 2 — UX 일관성

| ID | 내용 | 파일 |
|----|------|------|
| 3.3 | ErrorScreen 중앙화 | `components/feedback/ErrorScreen.tsx` + 5개 error.tsx wrapper |
| 1.4 | EmptyState 컴포넌트 + 적용 | `components/feedback/EmptyState.tsx` + 4개 파일 5곳 |
| 2.3 | 조건부 fetch (teachers page) | `app/(admin)/admin/teachers/page.tsx` — `listClassesWithDetails` 조건부화 |
| 1.3 | Suspense 경계 (학생 dashboard) | `app/(academy)/academy/student/_components/DashboardWidgets.tsx` 신규 + page.tsx 재구성 (4개 async 위젯 각자 Suspense) |

### Week 3 — 코드 품질

| ID | 내용 | 파일 |
|----|------|------|
| 4.1 | formatStudentName 일관 적용 — 52곳 치환 | `lib/utils/student-name.ts` 확장(`fallback?` 옵션), 18개 파일 수정 |
| 4.2 | ActionResult 타입 표준 | `lib/types/server-action.ts` 신규 + barrel re-export. 기존 188개 액션은 점진 마이그레이션 |
| 4.3 | bus-actions 분할 (부분) | `bus-staff.ts`만 분리 (3함수, 2814→2673줄). 나머지 4분할 Backlog |
| 5.2 | supabase gen-types 스크립트 | `package.json`에 `db:types` 추가. 실행은 사용자 |
| 6.1 | Sentry/Analytics | `docs/observability-setup.md` 가이드 (코드 변경 없음) |

### Week 4 — 디자인·캐싱·운영

| ID | 내용 | 파일 |
|----|------|------|
| 3.2 | Hero 색상 토큰화 | `globals.css`에 `--brand-yellow` 추가, `Hero.tsx`를 `var(--brand-*)` 참조로 전환 + 기존 unescaped quote 정리 |
| 2.5 | xlsx/exceljs 동적 import | `app/(admin)/admin/bus/export/route.ts` type-only import + runtime `await import("exceljs")` |
| 3.1 | CSS Modules → Tailwind (MainProgram) | `MainProgram.module.css` 삭제, TSX 전면 Tailwind 리라이트. 원본 3-tier 브레이크포인트(768/1280) 보존 |
| 2.4 | Cache Components | `docs/cache-components-setup.md` 가이드 (전역 활성화는 전체 페이지 회귀 테스트 필요) |
| 6.2 | 테스트 인프라 | `docs/test-infrastructure-setup.md` 가이드 (Jest + Playwright 설치 + 우선순위 5개 테스트 초안) |

### 검증

- 매 주 작업 후 독립 code-reviewer agent로 검증 → 모두 **MERGE_READY** 판정
- `npx tsc --noEmit`: 회귀 없음
- `npm run lint`: 신규 작업 파일에 에러 없음. 기존 89건(MultiDatePicker, QueryTabNav, use-bus-realtime, scripts/)은 사전 존재

---

## 남은 작업 (우선순위 순)

### 🔴 사용자 직접 수행 필요 (외부 리소스)

| # | 항목 | 액션 | 비고 |
|---|------|------|------|
| 1 | **DB 인덱스 마이그레이션 적용** | `supabase/migrations/20260418000000_add_hot_indexes.sql` 을 Supabase에 push | dashboard SQL 실행 또는 `supabase db push` |
| 2 | **RLS Phase 1-5** | prod 현재 정책 상태 조회 → staging에서 단계별 적용 | Supabase MCP 연결 확인 후 Phase 1(users)부터. plan §5.1 참조 |
| 3 | Sentry + Vercel Analytics 설치 | `docs/observability-setup.md` 따라 설치 | Sentry DSN 발급 필요 |
| 4 | Jest + Playwright 설치 | `docs/test-infrastructure-setup.md` 따라 설치 | staging Supabase 분리 필요 |
| 5 | Cache Components 활성화 | `docs/cache-components-setup.md` 따라 `cacheComponents: true` + 페이지 회귀 테스트 | staging 먼저 |

### 🟡 코드 작업 Backlog (다음 세션에서 처리 가능)

| 우선순위 | 항목 | 예상 소요 | 위험도 |
|---------|------|---------|-------|
| 1 | **1.3 Suspense 확대** — 교사/관리자 대시보드 (학생만 완료됨) | 반나절 | 낮음 |
| 2 | **3.1 CSS Modules 4개 남음** — Wonderland, CurriculumProgram, WonderK, PrimoSchool, QuestAcademy | 2-3일 | 낮음 |
| 3 | **4.3 bus-actions 나머지 4분할** — bus-master, bus-assignments, bus-operations, bus-requests | 3일 | **중간** (2673줄 안전 분할) |
| 4 | **5.3 RPC 트랜잭션화** — approveChangeRequest, enrollStudent, bulkRecordAttendance | 1주 | **중간** (atomic 설계 + PL/pgSQL) |
| 5 | **3.4 접근성** — `text-slate-400` 151곳 상향, 메가메뉴 keyboard, focus trap, age color 라벨 | 반나절 | 낮음 |
| 6 | **1.5 NavigationProgress 강화** — mutation 버튼 useTransition 적용 | 1시간×N 분산 | 낮음 |
| 7 | **4.2 ActionResult 기존 188개 점진 마이그레이션** | 1일×N 분산 | 낮음 |
| 8 | **3.5 Placeholder 페이지** 7개 콘텐츠 | 1주 (콘텐츠 작업) | 낮음 |
| 9 | **4.4 공유 컴포넌트 추출** — UserInfoCard, SearchBox, MonthYearPicker, BulkActionBar | 1주 | 낮음 |
| 10 | **2.6 bus-monitor 재연결** — exponential backoff | 반나절 | 낮음 |
| 11 | **6.3 Zod top 10 액션** | 3일 | 낮음 |
| 12 | **3.6 SEO·OG 이미지** — metadata, opengraph-image.tsx, JSON-LD | 2시간 | 낮음 |
| 13 | 4.6 `new Date().toISOString()` 62회 정리 | 반나절 | 낮음 |
| 14 | 5.4 Soft Delete 정책 통일 | 반나절 (정책 결정 후) | 낮음 |
| 15 | 5.5 마이그레이션 위생 (헤더 주석, down.sql) | 지속 | 낮음 |
| 16 | 6.4 GitHub Actions CI | 반나절 | 낮음 |
| 17 | 교사용 출결 일괄 입력 UI | 1-2일 | 낮음 |
| 18 | radix-ui v2 업그레이드 | 1일 | 낮음 |

### 🟢 검증 agent가 지적한 Week 2 간접 부채 (쉬운 정리)

- `app/(academy)/academy/student/homework/StudentHomeworkClient.tsx`의 `new Date().toLocaleDateString("ko-KR")` 분산 패턴 → `formatDateKst()` 통일
- `StudentBusClient.tsx`의 `window.confirm()` → `<ConfirmDialog>` 교체
- `StudentBusClient.tsx:114-117`의 직접 Date 연산 → `todayKst()`

---

## 미커밋 변경 파일 목록 (git 상태 기준)

**신규:**
- `components/skeletons/SkeletonBone.tsx`
- `components/feedback/ErrorScreen.tsx`, `EmptyState.tsx`
- `app/(academy)/academy/student/_components/DashboardWidgets.tsx`
- `app/(admin)/admin/actions/bus-staff.ts`
- `lib/types/server-action.ts`
- `supabase/migrations/20260418000000_add_hot_indexes.sql`
- `docs/observability-setup.md`
- `docs/cache-components-setup.md`
- `docs/test-infrastructure-setup.md`
- `docs/work-summary-2026-04-20.md` (이 문서)

**수정:** loading.tsx 7개, error.tsx 5개, skeletons 4개, `auth-helpers.ts`, `admin/actions.ts`, `bus-actions.ts`, `student-name.ts`, `lib/types/index.ts`, `package.json`, `globals.css`, `Hero.tsx`, `MainProgram.tsx`, `bus/export/route.ts`, 그리고 formatStudentName 적용한 18개 파일

**삭제:** `app/(site)/_components/sections/MainProgram.module.css`

---

## 다음 세션에서 말할 것

### 시나리오 A — RLS 작업 이어서 하고 싶으면 (Supabase MCP 확인 필요)
```
C:\scwonderland 이어서 작업.
docs/work-summary-2026-04-20.md 먼저 읽어.
Supabase MCP 연결 확인해서 prod DB의 현재 RLS 정책 상태 조회해줘.
그다음 플랜 5.1 Phase 1 (users: profiles/students/teachers) SQL 초안 작성.
```

### 시나리오 B — 현재 변경분 커밋만 먼저 (안전)
```
C:\scwonderland 이어서 작업.
docs/work-summary-2026-04-20.md 읽고 지금까지 변경분 내용 확인한 뒤,
커밋+푸시해줘. (DB 마이그레이션은 제외, 코드 변경만)
```

### 시나리오 C — 코드 Backlog 진행
```
C:\scwonderland 이어서 작업.
docs/work-summary-2026-04-20.md 읽어.
Backlog 1번 (Suspense 확대, 교사/관리자 dashboard) 진행해줘.
```
(또는 번호 바꿔서 원하는 항목 지정)

### 시나리오 D — 테스트 인프라부터 구축
```
C:\scwonderland 이어서 작업.
docs/test-infrastructure-setup.md 따라서 Jest 설치하고
lib/utils/date-kst.ts, student-sort.ts 단위 테스트 우선 작성.
Playwright는 제외.
```

### 새 세션에서 반드시 주의할 점

1. **이 작업은 아직 커밋 안 됐어.** 새 세션 시작하면 먼저 `git status` 해서 변경분 확인.
2. **수정된 파일이 많아 (50+개)** — 한 번에 커밋하지 말고 주제별로 분리 권장:
   - `feat: add SkeletonBone + ErrorScreen + EmptyState components`
   - `perf: cache auth helpers + add hot DB indexes migration`
   - `refactor: consolidate formatStudentName usage + split bus-staff actions`
   - `feat: student dashboard Suspense + ActionResult type standard`
   - `style: convert MainProgram CSS module to Tailwind + Hero brand tokens`
   - `docs: observability/cache/test infrastructure setup guides`
3. **RLS 작업은 staging 없이 prod 직접 적용 금지.** 적용 전 반드시 staging 환경에서 학생/교사/관리자/anon 키 각각으로 전체 페이지 수동 QA.
4. **이 프로젝트 CLAUDE.md 준수:** `lib/utils/date-kst.ts`, `formatStudentName`, `verifyAdmin/Authenticated/TeacherOrAdmin` 사용, mutating action은 인증 헬퍼 필수.

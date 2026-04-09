# SC Wonderland 프로젝트 종합 분석 리포트

> **생성일:** 2026-04-09
> **최종 업데이트:** 2026-04-09 (완료 조치 반영)
> **분석 방식:** 6개 영역 병렬 심층 분석 (Architecture · Database · Security · Performance · Code Quality · Feature Gaps)
> **대상 커밋:** `0a72efb` (main)

---

## ✅ 2026-04-09 완료된 조치 (이 리포트의 Phase 1 작업)

아래 항목은 분석 직후 즉시 반영된 사항입니다. 체크된 항목은 더 이상 해결 대상이 아닙니다.

### 보안 Critical
- [x] **Open Redirect 수정** — `app/(academy)/academy/login/LoginForm.tsx` — `safeRedirect()` 헬퍼 도입. `/`로 시작하고 `//`·`\\`를 포함하지 않는 내부 경로만 허용
- [x] **PII 로깅 제거** — `app/(admin)/admin/actions/user-actions.ts` — 이메일을 로그 컨텍스트에서 제거, `userId`만 기록. 모든 `console.error`는 `logger.error`로 치환
- [x] **innerHTML XSS 수정** — `StudentTimetableClient.tsx`, `StudentTimetableTab.tsx` — `printRef.innerHTML` 기반 방식 폐기. 데이터에서 `escapeHtml()`로 HTML 문자열을 빌드하여 새 창 생성
- [x] **권한 검증 TODO 7건** — `homework-actions.ts`, `attendance-actions.ts`, `learning-actions.ts`의 mutating 액션에 신규 헬퍼 `verifyTeacherOrAdmin()` 적용 (교사+관리자 공용 write 검증)
- [ ] ~~Bus Monitor 무인증 layout~~ — **사용자 요청으로 유지** (의도적 공개)
- [ ] **RLS 정책 명시** — DB 작업 필요, 별도 마이그레이션 PR 권장 (아직 미처리)

### Code Quality
- [x] **Timezone 유틸리티 도입** — `lib/utils/date-kst.ts` 신규. `todayKst()`, `formatDateKst()`, `formatDateTimeKst()`, `formatTimeKst()`, `nowKstParts()` 제공. 6곳의 분산 `toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" })` 호출 제거
- [x] **console.error → logger.error 치환** — `app/(admin)/admin/actions/` 전체 파일(12개)에서 `console.error` 제거 완료. `report-actions.ts`, `afterschool-actions.ts`, `timetable-actions.ts`, `class-notice-actions.ts`에는 logger import 신규 추가
- [x] **HTML Escape 유틸** — `lib/utils/escape-html.ts` 신규
- [x] **학생 정렬 유틸 통일** — `attendance-actions.ts#getClassStudentsWithAttendance`가 `sortStudentsByAgeAndName()` 사용
- [x] **proxy.ts matcher 보완** — 정적 리소스(woff/woff2/ttf/otf/eot/css/js/avif/ico/map/txt/xml/json) 전부 제외로 세션 갱신 오버헤드 감소

### Performance
- [x] **html-to-image 동적 import** — `DropoffOverviewPanel.tsx`가 `await import("html-to-image")` 방식으로 전환. 번들에서 제거돼 초기 로드 비용 ~100KB 절감

### Feature
- [x] **학생 대시보드 위젯** — `/academy/student` 페이지에 3종 위젯(미제출 숙제 / 이번 달 출석률 / 최근 학습 기록) + 숙제 바로가기 CTA 추가
- [x] **리포트카드 이전 달 복사** — 원어민 교사가 신규 작성 시 "이전 달 내용 불러오기" 버튼으로 `getReportCard(student, prevYear, prevMonth)` 조회 → textarea 주입 (저장 전 편집 가능)
- [ ] ~~학부모 포털~~ — **사용자 요청으로 제외**
- [ ] ~~수강료/결제 시스템~~ — **사용자 요청으로 제외**

### 문서 동기화
- [x] `.claude/rules/core.md` — 공통 유틸 규칙, 인증 헬퍼 3종, 로거/날짜/escape/redirect 규칙 추가
- [x] `.claude/rules/patterns.md` — safe redirect·HTML escape·KST date 패턴 섹션 신설
- [x] `.claude/rules/server-actions.md` — `verifyTeacherOrAdmin` 등록, homework/attendance/learning 권한 갱신
- [x] `.claude/routes/shared-actions.md` — 권한 컬럼 갱신
- [x] `.claude/routes/shared-lib.md` — `date-kst`, `escape-html`, `logger` 항목 추가
- [x] `.claude/routes/academy-student.md` — 대시보드 위젯 동작 흐름, Timetable XSS 수정 방식 반영
- [x] `.claude/routes/academy-teacher.md` — 리포트 페이지 역할별 UI 분기, 이전 달 복사 버튼 명시
- [x] `.claude/CLAUDE.md` — 공통 유틸 섹션 추가

### 여전히 남아있는 주요 과제 (별도 세션 권장)
- **RLS 정책 명시** — 각 테이블에 `ENABLE ROW LEVEL SECURITY` + role 기반 policy SQL 마이그레이션 필요
- **`bus-actions.ts` 2,520줄 분할** — 파일이 단일 PR에서 다루기에는 너무 큼
- **Zod 스키마 도입** — 주요 폼·mutating 액션 10개에 적용
- **Supabase `gen-types` 자동화**
- **Jest/Playwright 테스트 인프라**
- **a11y 대규모 감사** (aria-label 500+)
- **Suspense 경계 확대**
- **출결 일괄 입력 교사용 UI** (관리자용 `bulkRecordAttendance`는 이미 존재, 교사 UI만 추가 필요)
- **radix-ui v2 업그레이드**

---

## 🎯 Executive Summary

SC Wonderland는 Next.js 16 + React 19 + Supabase 기반의 **잘 짜인 학원 관리 플랫폼**입니다. 도메인별로 101개의 Server Action이 정돈돼 있고 TypeScript strict가 켜져 있으며 타입 아키텍처(`database.ts` / `api.ts` / `index.ts`)도 명확합니다.

그러나 프로덕션 품질로 가기 위해서는 **보안 Critical 4건**, **Timezone 혼재**, **RLS 정책 부재**, **테스트 0건**을 우선 해결해야 합니다.

| 영역 | 등급 | 핵심 이슈 |
|---|---|---|
| Architecture | **B+** | `bus-actions.ts` 2,520줄 분할 필요, (admin)/m 통합 |
| Database | **C+** | RLS 정책 명시 부재, 수동 타입, N+1 쿼리 |
| Security | **C** | Open Redirect, Bus Monitor 인증 부재, XSS 위험, PII 로깅 |
| Performance | **B** | `html-to-image` 번들 포함, Suspense 1건, a11y 2% |
| Code Quality | **B-** | 테스트 0, Timezone 혼재, console.error 155건, Zod 미사용 |
| Feature 완성도 | **B** | 학부모 포털·결제·상담 예약 완전 부재 |

---

## 🔴 즉시 조치 필요 (Critical)

### 1. Open Redirect 취약점
**위치:** `app/(academy)/academy/login/LoginForm.tsx:46`
```typescript
const next = searchParams.get("next") ?? "/academy/dashboard";
router.push(next);  // ?next=https://evil.com 허용
```
**수정:**
```typescript
const rawNext = searchParams.get("next")?.trim();
const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
  ? rawNext
  : "/academy/dashboard";
```

### 2. Bus Monitor 인증 부재
**위치:** `app/(monitor)/bus-monitor/layout.tsx`
- 인증 검증 없이 `<>{children}</>` 반환 → 누구나 접근 가능
- `(admin)/layout.tsx`처럼 role 검증 추가 필요

### 3. 민감 정보 로깅
**위치:** `app/(admin)/admin/actions/user-actions.ts:45, 59, 97, 112`
- 이메일을 `logger.info`/`console.error`에 기록
- `email` 제거하고 `user_id`만 로깅

### 4. innerHTML XSS 위험
**위치:**
- `app/(academy)/academy/student/timetable/StudentTimetableClient.tsx:66`
- `app/(admin)/admin/students/components/StudentTimetableTab.tsx:78`
```typescript
const printContent = printRef.current.innerHTML;
win.document.write(`...<body>${printContent}</body>...`);
```
- 학생명 입력에 `<img onerror=...>` 주입 가능
- DOMPurify 적용 또는 `window.print()` 기반으로 재작성

### 5. RLS 정책 명시 부재
- `supabase/migrations/`에 RLS 활성화/정책 SQL 코드 없음
- `createAdminClient()`가 RLS를 우회하므로 `verifyAdmin()` 실패 시 전체 데이터 노출 가능
- **조치:** 각 테이블에 `ENABLE ROW LEVEL SECURITY` + role 기반 policy 마이그레이션 작성

---

## 🏗️ Architecture 분석

### 강점
- 5개 Route Group이 논리적으로 잘 분리됨 (site/admin/academy/bus/monitor)
- Server Actions 16개 파일 7,680줄이 도메인별로 분할
- 타입 아키텍처 명확 (database/api/index)

### 문제점
| 항목 | 현황 | 개선 제안 |
|---|---|---|
| `bus-actions.ts` | **2,520줄 / 47개 함수** | `bus-core.ts`(호차·시간대·정류장) + `bus-assignments.ts` + `bus-requests.ts`로 분할 |
| `schedule-actions.ts` | 739줄, 반/개인 혼재 | `class-schedule.ts` / `student-schedule.ts` 분리 |
| `textbook-actions.ts` | 796줄, CRUD+진도 혼재 | `textbook-progress.ts` 분리 |
| `(admin)/m/` 모바일 라우트 | 별도 폴더로 분산 | `admin/(mobile)` 그룹 또는 viewport 감지 통합 |
| `/components/bus/` | 전역인데 admin/bus에서만 사용 | `app/(admin)/admin/bus/components/`로 이동 |
| "use client" | 104개 (48%) | Nav류 Server 전환, lint rule로 남용 방지 |
| 폼 패턴 | `useActionState` / `useState+FormData` / 직접 호출 혼재 | 표준 수립 (복잡 폼=useActionState, 단순=useTransition) |

---

## 🗄️ Database / Supabase 분석

### 발견 사항
1. **RLS 정책 부재** (🔴) — 마이그레이션에 `ENABLE ROW LEVEL SECURITY` 없음
2. **수동 타입 관리** — `lib/types/database.ts`가 수동 작성. Supabase `gen-types` 미사용 → 스키마 변경 시 동기화 누락 위험
3. **N+1 쿼리**
   - `report-actions.ts:42-48` — `author_id`로 teachers 단건 조회 반복
   - `user-actions.ts:238-243` — 3단계 수동 join
   - `bus-actions.ts:119+` — inner join으로 개선 가능
4. **트랜잭션 부재** — Supabase RPC 미사용. `enrollStudent()`, 버스 변경 승인 등 다중 테이블 조작 시 atomicity 미확보
5. **인덱스 미명시** — `student_profile_id`, `class_id`, `(year, month)`, `check_date` 등 빈번한 필터 컬럼
6. **Soft Delete 불일치** — profiles/textbooks만 soft, 공지/숙제/출결은 hard delete
7. **Storage 경로** — `generateStoragePath()` 타임스탬프 예측 가능 → UUID 추가 권장
8. **Edge Function 미활용** — `translate.ts` DeepL 호출이 Server Action 내 동기 실행 → Edge Function 분리 시 응답 속도 개선

### 즉시 조치
```sql
-- 모든 테이블에 RLS 활성화 예시
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
-- ... 각 역할별 정책 작성
```

```bash
# Supabase 타입 자동 생성
supabase gen types typescript --project-id <ID> > lib/types/database.generated.ts
```

---

## 🔒 Security 상세

| # | 이슈 | 심각도 | 위치 |
|---|---|---|---|
| 1 | Open Redirect | 🔴 | `LoginForm.tsx:46` |
| 2 | Bus Monitor 무인증 | 🔴 | `bus-monitor/layout.tsx` |
| 3 | PII 로깅 | 🔴 | `user-actions.ts:45,59,97,112` |
| 4 | innerHTML XSS | 🔴 | `StudentTimetableClient.tsx:66` |
| 5 | RLS 정책 부재 | 🔴 | `supabase/migrations/` |
| 6 | 숙제 권한 검증 TODO | 🟡 | `homework-actions.ts:70-79` |
| 7 | 출결 소유권 검증 TODO | 🟡 | `attendance-actions.ts:97` |
| 8 | 학습기록 권한 TODO | 🟡 | `learning-actions.ts:28` |
| 9 | proxy matcher 불완전 | 🟡 | `proxy.ts:50-52` (woff/css/js 미포함) |
| 10 | Admin Client 과다 사용 | 🟡 | `academy/layout.tsx:20-26` |
| 11 | Rate Limiting 부재 | 🟡 | 전역 |
| 12 | 빈 next 파라미터 | 🟡 | `LoginForm.tsx:21` |
| 13 | CSRF | 🟢 | Next.js 기본 OK |
| 14 | 파일 업로드 검증 | 🟢 | `storage.ts:70-82` OK |

### Rate Limiting 제안
```typescript
// proxy.ts 추가
import { rateLimit } from "@/lib/rate-limit";

if (pathname.startsWith("/api/auth") || pathname.endsWith("/login")) {
  const ok = await rateLimit(request.ip, { limit: 5, window: 60_000 });
  if (!ok) return new NextResponse("Too many requests", { status: 429 });
}
```

---

## ⚡ Performance / UX / A11y

### 우선순위 개선
| P | 항목 | 현재 | 목표 | 기대 효과 |
|---|---|---|---|---|
| **P0** | `html-to-image` 동적 import | `DropoffOverviewPanel` 최상위 import | `dynamic(() => import("html-to-image"))` | **번들 -100KB** |
| **P0** | Suspense 경계 확대 | 1건 | 주요 12개 페이지 | LCP -30%, CLS 개선 |
| **P0** | 접근성 aria-label | 39건 (2%) | 500+ | WCAG AA 달성 |
| **P1** | next/image sizes | 9건 중 5건만 명시 | 전부 명시 | Lighthouse +15 |
| **P1** | revalidatePath 확대 | 1건 | mutation마다 | 캐시 히트율 +40% |
| **P1** | `xlsx`/`exceljs` 동적 import | 절반만 | 전부 | 번들 추가 감소 |
| **P2** | 모바일 테이블 | 가로 스크롤 부재 | 카드 fallback | 모바일 CWV 통과 |

### 접근성 심각 지적
- 색상 대비: `text-slate-400` / `bg-slate-100` → WCAG AA 미달 가능
- 모달 포커스 트랩 없음
- 폼 `<label>` ↔ input 연결 미흡 (shadcn Input 사용하지만 명시적 `htmlFor` 누락)
- 키보드 네비 Tab 순서 미관리

### 실시간/프린트
- ✅ `use-bus-realtime.ts` cleanup 정상
- ❌ 재연결/재시도 로직 부재
- ❌ `html-to-image` 클라이언트 CPU 부하 → API Route(서버)에서 PDF/PNG 생성 위임 권장

---

## 🧹 Code Quality / Tech Debt

### 강점
- ✅ TypeScript `strict: true`
- ✅ `any/unknown` 15건으로 최소화
- ✅ `textbook-constants.ts` 등 상수화 잘됨
- ✅ `logger` 모듈 인프라 존재

### 주요 부채
1. **테스트 0건** ❌
   - `upsertReportCard` (DeepL 번역), `addSingleClassSchedule` (충돌 검사), `getDailyBusManifest` (복합 조인) 등 핵심 무보호
2. **Timezone 혼재** ⚠️
   - `new Date().toISOString()` (UTC) vs `toLocaleString("ko-KR")` (브라우저 로컬) 혼용
   - **출석 날짜 경계 오류 발생 가능**
   - 사례: `bus-actions.ts:64` vs `StudentHomeworkClient.tsx:171`
   - 해결: `date-fns-tz` 도입, 모든 날짜 KST `YYYY-MM-DD` 문자열로 정규화
3. **Validation 미흡** — Zod 없음. 서버 단일 방어선
4. **에러 로깅 불일치** — `logger` 19개 파일 vs `console.error` 155건
5. **TODO 7건** — 모두 권한 검증 관련 (`verifyAdmin()` 도입 필요)
6. **중복 로직** — 학생 정렬, 출석 상태 변환, 날짜 포맷이 여러 곳에 복붙
7. **타입 일관성** — `age?: number | null` vs `age: number | null` 혼재 (`api.ts:92` vs `:155`)
8. **radix-ui 1.4.3** — 메이저 업그레이드 필요 (최신 ~2.x)

### Phase별 개선 계획
**Phase 1 (즉시)**
- Timezone 통일 (`date-fns-tz` 도입)
- `console.error` 155건 → `logger.error` 치환
- 보안 Critical 4건 수정

**Phase 2 (1주)**
- 타입 일관성 리팩토링
- TODO 7건 권한 검증 완료
- 주요 Server Actions 10개 Zod 스키마 도입

**Phase 3 (2주)**
- Jest + Testing Library 기본 설정
- Integration test 3개 (attendance upsert, bus manifest, report translation)
- `utils/sort-student.ts`, `formatDateKST()` 헬퍼 통일

---

## 🚀 Feature Gap & 로드맵

### 현재 완전 구현된 도메인
- 공개 사이트, 학생·교사·관리자 포털, 승하차 시스템, 공지/숙제/리포트카드(DeepL 번역), 출결, 교재 진도

### 명백히 빠진 학원 필수 기능

| # | 기능 | 임팩트 | 난이도 | 근거 |
|---|---|---|---|---|
| 1 | **학부모 포털** (다자녀, 자녀 조회, `parent_student_links`) | 🔥 높음 | 높음 | `docs/esmart-campus-features-plan-2026-03-17.md` P1-B |
| 2 | **수강료/결제** (Toss/Iamport, `payment_history`) | 🔥 높음 | 높음 | 관련 코드 0 |
| 3 | **상담 예약** (`/community/parent-consultation` placeholder 상태) | 중간 | 중간 | 페이지만 존재 |
| 4 | **레벨 테스트 연동** (현재 외부 링크뿐) | 중간 | 높음 | `SideBar.tsx:28` |
| 5 | **학생 대시보드 위젯** (미제출 숙제·출석률·학습 기록) | 🔥 높음 | **낮음** | Admin 함수 재사용 가능 |
| 6 | **출결 일괄 입력** (반 단위 체크박스) | 🔥 높음 | 중간 | 기존 API 재사용 |
| 7 | **리포트카드 이전 달 복사/템플릿** | 중간 | **낮음** | 원어민 교사 시간 절감 |
| 8 | **별 포인트 게이미피케이션** (`learning_records.stars`) | 중간 | **낮음** | P2-C 기획 완료 |
| 9 | **출석률 통계 대시보드** (월별 차트, recharts) | 중간 | 낮음 | Admin 대시보드 확장 |
| 10 | **학생 이탈 예측 (at_risk)** | 중간 | 높음 | 데이터 기반 운영 |

### 운영/DevOps 부재
- ❌ `.github/` 없음 → GitHub Actions CI/CD 필요
- ❌ Sentry 등 에러 모니터링 없음
- ❌ Vercel Analytics 미연동
- ❌ `scripts/seed.ts` 시드 데이터 없음
- ❌ E2E 테스트 없음 → Playwright 도입

### 그 외 제안
- **PWA 오프라인** — 버스 기사용 포털, Service Worker + IndexedDB 체크인 큐
- **실시간 알림** — Supabase Realtime 이미 사용 중, 공지/숙제 제출 토스트 확장 가능
- **i18n 정식 도입** — 현재 `teacher-labels.ts` 수동 맵, 확장 시 `next-intl` 고려 (우선순위 낮음)

---

## 📋 우선 구현 순서 (사업 임팩트 기준)

1. 🔴 **보안 Critical 4건 + RLS 정책 추가** (1~2일)
2. 🔴 **Timezone 통일 + console.error 치환** (3일)
3. 🟡 **학생 대시보드 위젯** (낮은 비용, 즉각 UX 개선) — 1주
4. 🟡 **출결 일괄 입력** (교사 시간 절감) — 3일
5. 🟡 **`bus-actions.ts` 분할 + N+1 개선** — 1주
6. 🟡 **Supabase `gen-types` 자동화 + CI/CD** — 3일
7. 🟢 **학부모 포털** (P1-B, 기획 완료) — 2~3주
8. 🟢 **별 포인트 게이미피케이션** — 1주
9. 🟢 **Jest + 핵심 integration test 3개** — 1주
10. 🟢 **상담 예약 시스템** — 2주
11. 🟢 **수강료/결제 시스템** — 3~4주

---

## 📎 Appendix: 파일 핫스팟 Top 10

1. `app/(admin)/admin/actions/bus-actions.ts` — 2,520줄 (분할 필요)
2. `app/(admin)/admin/actions/textbook-actions.ts` — 796줄
3. `app/(admin)/admin/actions/schedule-actions.ts` — 739줄
4. `lib/types/api.ts` — 584줄 (UI/도메인 타입 혼재)
5. `app/(monitor)/bus-monitor/layout.tsx` — 인증 부재
6. `app/(academy)/academy/login/LoginForm.tsx` — Open Redirect
7. `app/(admin)/admin/actions/user-actions.ts` — PII 로깅
8. `app/(admin)/admin/bus/components/DropoffOverviewPanel.tsx` — html-to-image 번들 포함
9. `proxy.ts` — matcher 불완전
10. `supabase/migrations/` — RLS 정책 SQL 부재

---

> 이 리포트는 6개 Explore 에이전트 병렬 분석 결과를 종합한 것입니다. 각 섹션의 구체적 file:line 참조는 직접 코드를 확인하고 작업에 착수하시기 바랍니다.

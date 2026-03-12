# SC Wonderland 프로젝트 종합 감사 리포트

**분석일:** 2026-03-11
**분석 범위:** Server Actions, React 컴포넌트, DB 스키마/타입, 라우팅/아키텍처, 스타일링/UX
**분석 파일 수:** 171개 컴포넌트 + 17개 서버 액션 + 타입/설정 파일

---

## 목차
1. [🔴 CRITICAL - 즉시 수정 필요](#1-critical---즉시-수정-필요)
2. [🟠 HIGH - 우선 수정](#2-high---우선-수정)
3. [🟡 MEDIUM - 개선 사항](#3-medium---개선-사항)
4. [🔵 LOW - 폴리시](#4-low---폴리시)
5. [✅ 잘 된 점 (Strengths)](#5-잘-된-점)
6. [📋 향후 TODO 로드맵](#6-향후-todo-로드맵)

---

## 1. CRITICAL - 즉시 수정 필요

### 1.1 Bus Monitor 페이지 인증 없음 (보안)

**위치:** `app/(monitor)/bus-monitor/page.tsx`

`(monitor)` 라우트 그룹에 `layout.tsx`가 없어서 **누구나** 접근 가능. 학생 이름, 나이, 버스 배정 정보가 공개됨.

**수정:** `app/(monitor)/layout.tsx` 생성 + 인증/권한 체크 추가

---

### 1.2 middleware.ts 미연결 (세션 관리)

**위치:** `proxy.ts` (존재하지만 middleware로 등록 안 됨)

`proxy.ts`에 Supabase 세션 갱신 함수가 정의되어 있지만, `middleware.ts`가 없어 실제로 실행되지 않음. 세션 갱신이 안 되어 예기치 않은 로그아웃 가능.

**수정:**
```typescript
// middleware.ts (프로젝트 루트에 생성)
import { proxy } from "./proxy";
export const middleware = proxy;
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

---

### 1.3 Read 함수 인증 누락 (Server Actions)

**영향 파일:**
- `class-actions.ts` — `listClassesWithDetails()`, `getClassWithStudents()` 등
- `schedule-actions.ts` — `listClassSchedules()`, `getStudentTimetable()` 등
- `class-notice-actions.ts` — `listClassNotices()` 등

쓰기 함수는 `verifyAdmin()`/`verifyAuthenticated()`로 보호되지만, **읽기 함수에는 인증 체크가 없음**. 비인증 사용자가 학교 운영 데이터를 조회할 수 있음.

**수정:** 모든 읽기 함수에 `verifyAuthenticated()` 추가

---

### 1.4 파일 업로드 후 DB Insert 실패 시 고아 파일

**영향 파일:** `academy-notice-actions.ts`, `class-notice-actions.ts`, `notice-actions.ts`

Storage 업로드 성공 → DB insert 실패 시 에러 체크 없음. 고아 파일이 Storage에 남고 사용자에게 성공으로 표시됨.

**수정:** insert 에러 체크 + 실패 시 업로드된 파일 삭제 + 에러 반환

---

### 1.5 DB 스키마-타입 불일치 (Bus System)

**위치:**
- `docs/schema/bus.sql` vs `docs/migrations/bus-system.sql` vs `lib/types/database.ts`

Schema 파일과 Migration 파일의 `bus_change_requests` 테이블 컬럼명이 다름:
- Schema: `new_bus_time_slot_id` (bus_time_slots 참조)
- Migration: `new_academy_period_id` (academy_periods 참조)

TypeScript 타입이 실제 DB 스키마와 불일치할 가능성. 런타임 오류 유발.

**수정:** 실제 DB 상태 확인 후 docs/types 동기화

---

## 2. HIGH - 우선 수정

### 2.1 캐시 무효화 없음 (모든 Mutation)

**영향:** 모든 Server Action 쓰기 함수 (~100개+)

어떤 mutation 함수도 `revalidatePath()`를 호출하지 않음. Server Component가 변경된 데이터를 자동 갱신하지 못하고, 사용자가 수동으로 새로고침해야 함.

**수정:** 모든 mutation 함수 끝에 관련 경로 `revalidatePath()` 추가

---

### 2.2 Cascading Insert 실패 시 조용한 성공 반환

**영향 파일들:**

| 파일 | 함수 | 문제 |
|------|------|------|
| `class-actions.ts` | `createClass()` | 교사 배정 실패해도 성공 반환 |
| `homework-actions.ts` | `createHomeworkAssignment()` | 학생 제출 레코드 생성 실패해도 성공 |
| `textbook-actions.ts` | `assignTextbookToClass()` | 학생 진도 레코드 upsert 실패해도 성공 |
| `bus-actions.ts` | `deleteBusStop()` | FK cleanup 실패해도 삭제 진행 |

**수정:** 모든 cascading 작업의 에러를 체크하고 실패 시 에러 반환

---

### 2.3 Bus 변경 요청 에러 미확인 (컴포넌트)

**위치:** `BusChangeRequestsPanel.tsx` (40-58줄)

`approveChangeRequest()`, `rejectChangeRequest()` 호출 결과를 확인하지 않고 항상 `toast.success()` 표시. DB 실패해도 사용자는 성공으로 인식.

**수정:** 반환값 확인 → 에러 시 `toast.error()`, 성공 시 `toast.success()`

---

### 2.4 `prompt()` 사용 (UX/접근성)

**위치:** `BusChangeRequestsPanel.tsx` (50줄)

브라우저 `prompt()`는 접근성 불량, 모바일 UX 나쁨, 디자인 불일치.

**수정:** 모달/인라인 입력 폼으로 교체

---

### 2.5 자동 갱신 타이머 stale closure

**위치:** `BusStaffMonitor.tsx` (333-346줄)

카운트다운 타이머와 실제 데이터 갱신 인터벌이 동기화되지 않음. 카운트다운이 실제 갱신 시점과 불일치.

**수정:** `setCountdown(prev => ...)` 함수형 업데이트 패턴 사용

---

### 2.6 `refreshStops()` 정의만 하고 미호출

**위치:** `BusAssignmentManager.tsx` (61-64줄)

버스 정류장 데이터를 갱신하는 `refreshStops()` 콜백이 정의되었지만 어디에서도 호출되지 않음. 다른 관리자가 정류장을 변경하면 반영 안 됨.

**수정:** 저장 완료 후 + 주기적 갱신에 호출 추가

---

## 3. MEDIUM - 개선 사항

### 3.1 SEO 메타데이터 누락 (16개 페이지)

`(site)` 그룹의 다수 페이지에 `generateMetadata` 또는 `metadata` export가 없음:

- `about-wonderland/` — certification, company-history, greeting, wonderland (4개)
- `program/` — map, primo-school, quest-academy, wonder-k, wonderland (5개)
- `experience/` — e-school, library, special-day (3개)
- `notice/news/page.tsx` (목록 페이지)

**영향:** 검색 결과와 소셜 미리보기에서 페이지별 제목/설명 없음

---

### 3.2 입력 유효성 검증 부족

| 파일 | 함수 | 누락 |
|------|------|------|
| `schedule-actions.ts` | `addSingleClassSchedule()` | classId/periodId 존재 여부 미확인 |
| `bus-actions.ts` | `upsertBusStopSchedule()` | 시간 형식(HH:MM) 미검증 |
| `attendance-actions.ts` | `listAttendanceRecords()` | month 범위 미검증 (0, 13 등 허용) |

---

### 3.3 대시보드 중복 인증 체크

**위치:** `app/(academy)/academy/dashboard/page.tsx`

부모 layout에서 이미 인증 체크하는데 page에서 다시 체크 → DB 쿼리 2배

**수정:** page.tsx에서 중복 인증 로직 제거 (역할별 리다이렉트만 유지)

---

### 3.4 일관성 없는 에러 표시 패턴

일부 컴포넌트는 `role="alert"` 사용, 일부는 미사용. 스크린리더 사용자에게 에러 알림이 안 될 수 있음.

**수정:** `<ErrorAlert>` 공통 컴포넌트 만들어 전체 적용

---

### 3.5 반환 타입 불일치

`listTeachersForSelect()`, `listAvailableStudents()` 등 일부 함수가 `{ error?: string }` 패턴 대신 배열을 직접 반환. 호출자가 에러인지 빈 데이터인지 구분 불가.

---

### 3.6 숙제 리뷰 권한 검증 미흡

**위치:** `homework-actions.ts` `reviewSubmission()` (313, 364줄)

submissionId 존재 여부와 리뷰어가 해당 반 교사인지 검증하지 않음.

---

### 3.7 사용자 목록 조회 성능

**위치:** `user-actions.ts` `listUsersByRole()` (129줄)

모든 Auth 사용자를 가져온 후 메모리에서 필터링. 사용자 수 증가 시 성능 저하.

---

### 3.8 브랜드 색상 미사용

`globals.css`에 `--brand-orange`, `--brand-green` 등 정의했지만 컴포넌트에서는 Tailwind 팔레트 색상(`red-500`, `orange-500`) 직접 사용. 디자인 토큰 시스템 불일치.

---

### 3.9 다크 모드 불완전

다크 모드 CSS 변수가 정의되어 있지만, 여러 컴포넌트에서 `bg-white`, `text-gray-900` 등 하드코딩된 라이트 색상 사용. 다크 모드에서 깨짐.

---

### 3.10 Radix UI v1 (레거시)

`package.json`에서 `"radix-ui": "^1.4.3"` 사용 중. v2가 최신 메이저 버전.

---

### 3.11 `next.config.ts` 하드코딩된 Dev IP

```typescript
allowedDevOrigins: ["192.168.45.127"]  // 특정 개발자 네트워크 전용
```

**수정:** 환경변수로 변경

---

### 3.12 `NEXT_PUBLIC_SITE_URL` 환경변수 누락

`.env.local`에 없어서 개발 환경에서도 프로덕션 URL(`https://scwonderland.com`)으로 폴백. Sitemap/robots.txt가 잘못된 URL 생성.

---

### 3.13 RLS 정책 누락

여러 테이블에 Row Level Security 정책이 설정되지 않음. Server Action에서 `createAdminClient()` (service role)을 사용하므로 현재는 동작하지만, defense-in-depth 관점에서 RLS 추가 권장.

---

## 4. LOW - 폴리시

### 4.1 오디오 요소 접근성

`StudentHomeworkClient.tsx`, `TeacherHomeworkClient.tsx`, `BusStaffMonitor.tsx`에서 `<audio>` 요소에 `aria-label` 없음. ESLint 경고를 `eslint-disable`로 무시 중.

### 4.2 아이콘 버튼 `aria-label` 누락

`GroupTimetableGrid.tsx` 등에서 아이콘 전용 버튼에 `title`만 있고 `aria-label` 없음.

### 4.3 React key 개선 필요

`GroupTimetableGrid.tsx`의 `PeriodDayGrid`에서 `day` 인덱스만 key로 사용. pending 상태 변경 시 reconciliation 문제 가능.

### 4.4 Navigation 더블 브래킷 버그

`Navigation.tsx` `getButtonClass()`에서 불필요한 이중 배열 래핑. 기능에는 영향 없지만 코드 정리 필요.

### 4.5 비동기 작업 cleanup 누락

`StudentHomeworkClient.tsx` 등에서 `useEffect` 내 비동기 호출 시 컴포넌트 언마운트 후 state 업데이트 가능. `cancelled` 플래그 추가 필요.

### 4.6 테스트 파일 없음

프로젝트에 `.test.ts`, `.test.tsx`, `__tests__/` 디렉토리 없음. 최소한 auth helper와 핵심 서버 액션에 대한 테스트 추가 권장.

### 4.7 하드코딩된 문자열 (i18n)

버스 관련 컴포넌트에서 요일 라벨("월", "화"...), 방향 라벨("등원", "하원") 등이 여러 곳에 중복 하드코딩.

---

## 5. 잘 된 점

| 영역 | 상세 |
|------|------|
| **인증 헬퍼** | `verifyAdmin()`, `verifyAuthenticated()` 중앙화, ~80개+ 쓰기 함수 보호 |
| **레이아웃 보호** | admin/academy/bus 라우트 그룹 모두 layout.tsx에서 인증/역할 체크 |
| **서버사이드 데이터 패칭** | `Promise.all()` 병렬 쿼리, `notFound()` 적절 사용 |
| **Supabase 3-tier 클라이언트** | Browser/Server/Admin 클라이언트 분리 |
| **에러 바운더리** | 5개 라우트 그룹에 `error.tsx` 구현, 한국어 메시지, 재시도 버튼 |
| **TypeScript strict** | `strict: true`, `any` 사용 거의 없음 |
| **Root SEO 메타데이터** | OG태그, 한국어 locale, 제목 템플릿 완비 |
| **학생 나이 색상** | `getAgeColor(age)` 함수로 일관된 시각 구분 |
| **ESLint 설정** | flat config, Next.js + TypeScript 룰, disable 7개만 (정당한 사유) |
| **`.gitignore`** | `.env*` 패턴으로 시크릿 보호 |
| **Toast 알림** | `sonner` 라이브러리로 `alert()` 대체 완료 |
| **N+1 쿼리 수정** | `getClassWithStudents()`, `listUsersByRole()` 등 이전에 수정 완료 |

---

## 6. 향후 TODO 로드맵

### Phase 1: 긴급 보안 수정 (이번 주)

- [ ] `app/(monitor)/layout.tsx` 생성 — 인증/권한 체크
- [ ] `middleware.ts` 생성 — proxy.ts 연결
- [ ] 모든 읽기 Server Action에 `verifyAuthenticated()` 추가
- [ ] 파일 업로드 관련 cascading insert 에러 체크 + 고아 파일 정리
- [ ] DB 스키마-타입-migration 동기화 확인

### Phase 2: 데이터 무결성 (이번 스프린트)

- [ ] 모든 mutation 함수에 `revalidatePath()` 추가
- [ ] Cascading insert 에러를 반환하도록 수정 (class/homework/textbook/bus)
- [ ] `BusChangeRequestsPanel` 에러 처리 + prompt() → 모달 교체
- [ ] 입력 유효성 검증 추가 (시간 형식, 날짜 범위, FK 존재 확인)
- [ ] 숙제 리뷰 권한 검증 강화
- [ ] `NEXT_PUBLIC_SITE_URL` 환경변수 설정

### Phase 3: UX/접근성 개선 (다음 스프린트)

- [ ] 16개 사이트 페이지에 메타데이터 추가
- [ ] 공통 `<ErrorAlert>` 컴포넌트 만들어 전체 적용 (`role="alert"`)
- [ ] 오디오 요소에 `aria-label` 추가
- [ ] 아이콘 버튼에 `aria-label` 추가
- [ ] 브랜드 색상 토큰 실제 사용으로 전환
- [ ] 대시보드 중복 인증 제거
- [ ] `refreshStops()` 실제 호출 + stale closure 수정
- [ ] React key 개선 (GroupTimetableGrid)

### Phase 4: 기술 부채 해소 (백로그)

- [ ] RLS 정책 추가 (defense-in-depth)
- [ ] Radix UI v2 업그레이드 검토
- [ ] 하드코딩 문자열 상수 파일로 추출
- [ ] 다크 모드 완전 지원 (하드코딩 색상 → 시멘틱 토큰)
- [ ] 핵심 유닛 테스트 추가 (auth helpers, server actions)
- [ ] `listUsersByRole()` 성능 개선 (프로필 테이블 기반 필터링)
- [ ] Navigation 더블 브래킷 정리
- [ ] useEffect cleanup (비동기 작업 취소 패턴)
- [ ] `next.config.ts` dev IP 환경변수화
- [ ] 반환 타입 일관성 통일

---

## 요약 통계

| 심각도 | 개수 | 비율 |
|--------|------|------|
| 🔴 CRITICAL | 5 | 11% |
| 🟠 HIGH | 6 | 13% |
| 🟡 MEDIUM | 13 | 29% |
| 🔵 LOW | 7 | 16% |
| ✅ 강점 | 14 | 31% |

**전체 평가:** 아키텍처 기반은 탄탄하나, 보안(모니터 미보호, 읽기 인증 누락)과 에러 처리(cascading 실패 무시)에 즉시 대응 필요. 나머지는 점진적 개선 가능.

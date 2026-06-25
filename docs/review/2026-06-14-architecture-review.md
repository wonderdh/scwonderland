# SC Wonderland 아키텍처 리뷰

> 작성일: 2026-06-14
> 범위: 프론트엔드 · 서버 액션 · DB · 횡단 관심사(품질/인프라)
> 방법: 4개 영역 병렬 코드 분석 (실제 읽은 코드 근거만, 추측 배제)

## 한 줄 요약

전반적인 골격(RSC 컨테이너 패턴, RLS 정책, FK 컨벤션, 인증 가드 규율)은 건강한 편이다.
가장 큰 구조적 부채는 **① 서버 액션 트랜잭션 전무 + service-role 디폴트화, ② `ActionResult` 등 "정의만 있고 채택 0건"인 표준들, ③ CI 부재**이며, 실제 동작 버그도 1건 발견됐다.

---

## 🔴 즉시 수정 권장 (버그 / 보안)

1. **KST 날짜 버그 (실버그)** — `src/lib/utils/weekly-sentence-week.ts:25-31`의 `getCurrentSunday`가 KST 인스턴트를 만든 뒤 로컬 타임존 getter(`getDay()`, `setDate()`)를 사용. UTC 서버에서 일요일에 실행하면 **한 주 전 일요일을 반환** → `weekly-sentence-actions.ts:218-229`의 `auto_base_sunday` 저장이 틀어짐. 로컬(KST) 개발기에선 재현되지 않는 prod-only 버그.
2. **reviewer 신원 스푸핑** — `bus/change-actions.ts:383,459`의 `approveChangeRequest`/`rejectChangeRequest`가 클라이언트가 보낸 `reviewerId`를 그대로 `reviewed_by`에 기록(415, 471행). `verifyAdmin()`이 반환하는 `auth.userId`를 써야 감사추적 위조가 막힘.
3. **무가드 read 액션 5개** — `bus/master-actions.ts`의 `listBusTimeSlots`(94행), `listBusStopDayAssignments`(299행), `listBusStopSchedulesBulk`(368행), `listBusStopSchedules`(405행), `getBusDayDataCounts`(594행)가 인증 없이 `createAdminClient()`(RLS 우회)로 조회. 서버 액션은 public POST 엔드포인트라 **비인증 사용자가 버스 노선/배정 데이터를 조회 가능**. 같은 파일의 `listBusNumbers`(17행)는 가드가 있어 일관성도 깨짐.
4. **auth user 고아 문제** — `user-actions.ts:40-82` `createStudent`가 auth 생성 → profiles → students 순차 insert인데 중간 실패 시 롤백 없음. 코드 주석(60-61행) 스스로 과거 orphan 발생을 인정하고, 이를 "자동 복구"하는 보상 코드(`updateStudentProfile:433`, `ensureStudentRecord`)가 누적된 상태.
5. **잔여 anon GRANT** — baseline(L1681)의 `ALTER DEFAULT PRIVILEGES … GRANT ALL TO anon` 때문에 5월 생성된 homework/lunch 계열 테이블에 anon grant가 남아 있는데, `20260601010000_revoke_anon_grants.sql`이 이들을 누락. RLS 정책 덕에 행은 안 보이지만 이중 방어 원칙상 REVOKE 마이그레이션 추가 권장.

---

## 🟠 구조적 부채 (영역별)

### 백엔드 — 서버 액션 (26개 파일, export 188개)

- **`ActionResult<T>` 채택 0건**: `src/lib/types/server-action.ts:25-34`에 표준 타입과 `ok`/`fail`/`okVoid` 헬퍼 + "점진 마이그레이션" 주석(23행)까지 있는데 사용처가 0. 실제로는 `{ error?: string }` 변형이 101곳 + 파일마다 다른 임의 반환형이 혼재. read 액션은 에러 시 빈 배열 반환(`class-actions.ts:198`)이라 "권한 없음"과 "데이터 없음"을 구분 불가.
- **4줄 prologue 반복**: 인증→에러체크→admin 클라이언트 생성이 ~170회 반복. try/catch는 26개 파일 중 4곳뿐(`weekly-sentence-actions.ts:138` 등)이라 예기치 못한 throw가 generic error로 노출. DB 에러 메시지(`error.message`)가 사용자 토스트에 그대로 나가는 곳도 광범위(`class-actions.ts:514`, `user-actions.ts:53` 등). 반면 `bus/change-actions.ts:566`은 `23505` 코드를 한국어로 번역 — 처리가 파일마다 임의적.
- **트랜잭션 전무**: `src` 전체 `.rpc()` 호출 0건. `createClass`(3단계 insert, `class-actions.ts:412`), `saveBusStopDayAssignments`(delete-then-insert — 실패 시 그날 배정 전체 소실, `bus/master-actions.ts:330`), `approveChangeRequest`(승인 후 출결 upsert, `bus/change-actions.ts:435`) 모두 비원자적.
- **revalidate 비일관**: `revalidateTag` 0건, 전부 `revalidatePath` 98회 경로 하드코딩. **bus 도메인 mutation은 revalidate가 아예 없고**(`bus/master-actions.ts`, `assignment-actions.ts` 등) realtime에만 의존 — 최근 커밋 `ba324de`가 보여주듯 이미 stale 버그를 냄. `user-actions.ts`는 모든 mutation이 `revalidatePath("/admin", "layout")`으로 과도하게 광범위.
- **입력 검증 없음**: zod 미사용(의존성에도 없음), `formData.get() as string` 수동 캐스팅 72곳. `createAdminBusChange`는 위치 인자 7개(`bus/change-actions.ts:599`)로 호출부 순서 실수에 취약.

### DB — 28테이블, 마이그레이션 39개 (5,051줄)

- **RLS 양호**: 28개 public 테이블 전부 활성화 + `private.get_my_role()` 등 SECURITY DEFINER 헬퍼 일관 적용. 셀프승인 차단·anon REVOKE·SELECT 좁히기 등 보안 강화 이력도 좋음. 그러나 `createAdminClient()` 호출이 184곳이라 실제 쓰기는 전부 RLS 우회 — DB 정책은 사실상 read 방어용.
- **text를 시간/enum 대신 사용**: `bus_time_slots.time`, `bus_stop_schedules.estimated_time`이 text(baseline L313, L339)라서 `substring(time FROM 1 FOR 5) = '16:20'` 같은 문자열 파싱 마이그레이션(`20260603000000` L21)이 나옴 → `time` 타입 전환 권장. `student_homework_progress.status`, `students.group_type`(CHECK조차 없음, baseline L482)도 enum 후보.
- **day_of_week 컨벤션 혼재**: 1–5(`class_schedules`), 0–6(`class_homework_books`, `20260523000000`), CHECK 없음(`student_bus_defaults`) 세 가지 공존.
- **날짜 단독 인덱스 부재**: `attendance.attendance_date`, `bus_change_requests.request_date`, `bus_check_records.check_date`가 `(student_id, date)` 복합 unique뿐이라 "특정 날짜 전체 학생" 조회(일별 출결판/버스보드 — 핵심 화면)를 인덱스가 커버 못 함.
- **기타**: `class_schedules.class_teacher_id`가 이름과 달리 `teachers(id)` 참조(같은 컬럼명이 `report_cards`에선 진짜 `class_teachers(id)` 참조 — 혼동 위험), lunch 테이블 `updated_at` 트리거 미부착(`20260530000000`), `class_homework_books`에 `created_at` 자체가 없음, `20260518` 마이그레이션이 존재하지 않는 `20260517` 파일을 전제(히스토리 어긋남 의심).

### 프론트엔드 (TS/TSX 321개, 클라이언트 126개)

- **RSC 경계 자체는 건강**: page.tsx = RSC + `Promise.all` fetch → 단일 `*Client` 컴포넌트 주입 패턴이 일관적(`admin/classes/page.tsx:23`). `academy/student/page.tsx:47-59`의 위젯별 Suspense 스트리밍은 모범. 문제는 클라이언트 컴포넌트 내부 비대화.
- **거대 파일(500줄+)**: `ClassesManager.tsx` **1,398줄 / useState 41개**(목록·필터·모달 5종·DnD·배치 저장을 한 파일에), `ClassHomeworkManageTab.tsx` 828줄, `BusNumbersManager.tsx` 783줄(useState 22개), `GroupTimetableGrid.tsx` 750줄 등 15개. 서버 액션도 비대: `homework-unit-actions.ts` 993줄, `bus/change-actions.ts` 824줄.
- **homework 도메인만 모바일/데스크톱 복붙 중복**: `GROUP_FILTERS`, `defaultPeriodId()`, `buildSearchHaystack()`이 `MobileHomeworkClient.tsx:24-47`와 `ClassHomeworkManageTab.tsx:37-61`에 동일 코드. "2:50 교시 우선" 휴리스틱은 3곳에 하드코딩. (대조적으로 attendance는 `useAttendanceEditor` 훅 공유로 모범적.)
- **이미 있는 도구를 안 씀**: `useAsyncData` 훅이 `(admin)/admin/hooks/`에 있는데 `StudentBusClient`, `DailyBusChanges`, `TeacherReportClient`가 같은 패턴 수동 재구현. `lib/ui/toast.ts` 래퍼는 6파일만 쓰고 32파일이 sonner 직접 import. 폼 idiom도 `useActionState`(2파일)/`useTransition`(20파일)/수동 saving 플래그 3종 혼재.
- **academy → admin actions 직접 import 10파일**: 보안 구멍은 아니지만(`verifyAuthenticated`/`@auth-skip` 처리됨) 폴더 경계 의도와 어긋나고, 학생용 read 함수가 admin 허브에 섞여 비직관적.

### 인프라 / 품질

- **CI 전무**: `.github` 디렉터리 없음. `type-check`, `lint`, `check:admin-imports`(service-role 키 클라이언트 노출 방지 스크립트!), `node --test`가 전부 사람 기억에 의존. 스크립트 주석(`check-admin-client-imports.mjs:15`)이 스스로 "PR/CI에서 돌리면 됨"이라 적어놓고 묶는 CI가 없음.
- **테스트 빈약**: `node:test` 기반 2개뿐(`stop-validation.test.mjs`, `homework-schedule.test.mjs`), `pnpm test` 스크립트조차 없음. `date-kst.ts`, `rotation.ts`, `weekly-sentence-week.ts` 같은 순수 로직이 무테스트.
- **타입 안전성**: `as any` 0건(우수)이나 `as [Type]` 캐스팅 128건/71파일. 근본 원인은 `src/lib/types/database.ts`가 generated Row 타입을 손으로 중복 정의한 것 — `Tables<>` 파생으로 교체 시 다수 소거.
- **xlsx 의존성**: CDN tarball(보안 이력 있는 패키지)인데 사용처가 1곳뿐(`weekly-sentence-actions.ts:139`, 읽기 전용). exceljs로 통합하면 의존성 자체 제거 가능.
- **env 검증 레이어 없음**: `process.env.X!` 단언 3파일(`supabase/server.ts`, `client.ts`, `proxy.ts`), `.env.example` 없음.
- **문서 드리프트**: CLAUDE.md/ARCHITECTURE.md:36이 "docs/ — 캐시·SSR·관찰성 패턴 가이드"를 안내하지만 실제 docs/에 해당 문서 없음.
- **error boundary 공백**: `global-error.tsx` 없음(루트 레이아웃 크래시 미커버), `(monitor)` 라우트 그룹에 `error.tsx` 없음(TV 디스플레이 — 죽으면 늦게 발견).

---

## 💡 적용 추천 디자인 패턴

1. **Action Wrapper 패턴 (최우선, 효과 최대)** — `withAuth("admin", async (ctx, input) => {...})` 형태 래퍼 하나로 인증 → try/catch → logger 태깅 → `ActionResult<T>` 반환 → revalidateTag까지 일괄. prologue 170회 반복, try/catch 부재, 가드 누락 가능성, 반환형 비일관 **네 가지를 한 번에** 해결. 신규 작성이 활발한 `bus/` 폴더부터 점진 적용. 적용 위치: `auth-helpers.ts` 확장 또는 `src/lib/server/action-wrapper.ts` 신설.
2. **Postgres RPC로 트랜잭션화** — 다단계 mutation을 `security definer` plpgsql 함수로 이전. 우선순위: `createStudent`(고아 문제) → `saveBusStopDayAssignments`(delete-then-insert) → `approveChangeRequest`(+출결).
3. **revalidateTag 기반 캐시 무효화** — 도메인당 태그 1개(`classes`, `bus`, `reports`…)를 상수로 정의하고 wrapper 옵션으로 선언. 경로 하드코딩 98곳 정리 + bus 도메인 stale 문제 해소.
4. **Hook + Presenter 분리 (attendance 패턴 전파)** — 사내 최고 모범 `useAttendanceEditor` 구조를 `ClassesManager`(→ `useClassEditor` + 프레젠터), homework 데스크톱/모바일(→ `useClassHomework` 공통 훅 — 중복 동시 해소), `ReservationDashboard`(두 도메인 → 훅 2개)에 적용.
5. **zod 입력 스키마** — FormData 파싱 파일(`user-actions.ts`, `notice-actions.ts`)과 7-인자 함수(`createAdminBusChange`)를 객체 인자 + 스키마 검증으로 전환.
6. **소규모 통일 작업** — `useAsyncData`를 `src/lib/hooks/`로 승격, `<UrlTabs>` compound component로 탭 3종 통일, `useConfirm`/`useInlineEdit` 훅, `/m` 라우트 공용 `MobileHeader`, sonner 직접 import를 `no-restricted-imports` lint로 차단, 생성 타입 `Tables<>` 파생으로 수동 Row 타입 대체(as 캐스팅 128건의 구조적 원인 제거).

---

## 권장 진행 순서

| 단계 | 작업 | 이유 |
|---|---|---|
| 1 | `getCurrentSunday` 버그 + `reviewerId` 스푸핑 + 무가드 read 5개 | 실버그/보안, 각각 소규모 수정 |
| 2 | CI 도입 (type-check + lint + check:admin-imports + test) | 이후 모든 리팩토링의 안전망 |
| 3 | Action wrapper + `ActionResult` 채택 (bus/부터) | 백엔드 부채 4종의 단일 수렴점 |
| 4 | RPC 트랜잭션화 (createStudent부터) | 데이터 정합성 |
| 5 | 날짜 인덱스 + enum/time 타입 전환 | DB 마이그레이션 묶음 |
| 6 | `ClassesManager` 분해 + homework 중복 해소 | 프론트 최대 부채 |

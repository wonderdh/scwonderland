# 06. 프론트엔드 · UX · 접근성 · 반응형 (2026-11-02, 코드 읽기 전용)

## 요약
- page-flow 5건 중 **해결된 것 없음** — 끊긴 notices 탭 2개는 여전히 404, 리딩 상세 링크·lunch 메뉴·모니터 무인증 그대로.
- 구조적 문제(공용 Modal/ConfirmDialog, /m↔/admin 컴포넌트 공유)는 잘 잡혀 있고, 남은 건 **일관성**: raw `<button>` 196개 vs `<Button>` 108개, 요일 배열 11곳 중복, 삭제 확인 없는 버튼 5곳.
- 다크모드는 토큰만 있고 토글이 없어 사실상 미지원이며, `dark:` 클래스는 shadcn 기본 파일 6개에만 존재.

## page-flow 5건 추적

| # | 발견 | 현재 상태 | 근거 |
|---|---|---|---|
| 1 | 교사·학생 notices 탭 404 | **미해결 🔴** | `src/app/academy/teacher/_components/TeacherNav.tsx:64`, `src/app/academy/student/_components/StudentNav.tsx:30` 에 href 유지, `academy/*/notices/` 폴더 없음 |
| 2 | `/admin/lunch` 사이드바 없음 | **미해결** | `src/lib/navigation/admin-nav.ts` 에 lunch 항목 없음. `/admin/lunch` 로 가는 Link 는 lunch 폴더 내부 3파일만 |
| 3 | 리딩 상세 `<Link>` 없음 | **미해결** | `/admin/reading/` href 0건. `reading/${` 는 `(admin)/m/reading/page.tsx` 만 |
| 4 | `/bus` 비활성 | 그대로(정보) | `src/app/bus/_components/BusStaffMonitor.tsx` 는 `(admin)/m/bus-check/page.tsx:4` 가 재사용하므로 죽은 코드 아님 |
| 5 | 모니터 2페이지 무인증 | **미해결** (의도된 결정, `da08da9`) | `src/app/(monitor)/bus-monitor/layout.tsx` 인증 없음, `lunch-monitor/page.tsx` 에 `getUser` 없음 |

추가로 발견한 끊김: **`/academy/teacher/bus/page.tsx`** 는 `redirect("/academy/teacher")` 만 하는 stub (TeacherNav 에도 없음), **`/admin/students/classes/page.tsx:7-11`** 은 "추후 구현 예정 / 준비 중입니다" placeholder 인데 어디서도 링크 안 됨. page-flow 2장은 `ST --> STC --> ST` 로 그렸지만 실제 `students/classes` 를 참조하는 코드 0건.

## 🔴

1. **notices 탭 404** — 위 #1. 개선안: 두 Nav 에서 항목 제거(공지 페이지 구현 전까지). 5분 작업.
2. **삭제 확인 없는 파괴적 액션 5곳** — `ConfirmDialog` 가 22파일에서 쓰이는데 아래는 즉시 실행:
   - `(admin)/admin/students/_components/StudentAttendanceTab.tsx:291-293` 출결 기록 삭제 (아이콘 버튼, aria-label 도 없음)
   - `(admin)/admin/closed-days/_components/ClosedDaysClient.tsx:155-157` 쉬는날 삭제
   - `(admin)/admin/homework/_components/PublishersDialog.tsx:205-207` 출판사 비활성
   - `(admin)/admin/bus/_components/BusDashboard.tsx:197-200` 당일변경 취소
   - `(admin)/admin/bus/_components/AdminBusChangeDnD.tsx:391-394` 변경 삭제

   개선안: 기존 `components/overlays/ConfirmDialog` 로 감싸기. 되돌리기(undo) 토스트가 있으면 생략 가능하지만 현재 없음.
3. **`/m` 과 `/admin` 의 역할 검사가 다른 함수** — `(admin)/m/layout.tsx:20-24` 는 `profiles.role !== "admin"` 직접 비교, `(admin)/admin/layout.tsx:20-27` 은 `getUserRoles().roles.includes("admin")`. 지금은 `user-roles.ts:26` 이 단일 role 배열이라 결과 같지만, 다중 역할 도입 시 모바일만 갈라짐. 개선안: m/layout 도 `getUserRoles` 사용.

## 🟡

**컴포넌트 재사용**
4. raw `<button>` 196 / `<Button>` 108 (admin), academy 는 9 / 6. 특히 `StudentAttendanceTab.tsx:291`, `ClosedDaysClient.tsx:155` 같은 액션 버튼이 Tailwind 직접 작성. 개선안: 신규 코드부터 `Button variant="ghost" size="icon"`.
5. native `<select>` 59개 / 32파일 (`TimetableManager.tsx` 6, `ClassesManager.tsx` 6). 이전 지적(REVIEW_UI 8.2) — 미해결. `components/ui/` 에 select 자체가 없음. 개선안: `npx shadcn add select` 대신 공용 className 상수 하나로 시각 통일 (라이브러리 추가 없이).
6. `components.json` 은 `iconLibrary: "lucide"` 인데 inline `<svg>` 73개 / 32파일, lucide 는 15파일. `TeacherNav.tsx`·`StudentNav.tsx` 는 heroicons path 를 통째로 복붙. 개선안: 두 Nav 의 아이콘만 lucide 로 교체하면 ~150줄 감소.
7. 죽은 공용 컴포넌트: `navigation/Breadcrumb` (0 사용, `getBreadcrumbForPath` 도 미사용), `ui/popover` (0), 기존 지적분 `QueryTabNav`/`FileUpload`/`AudioRecorder`/`FileList`/`ui/avatar`/`ui/tooltip` 여전히 0. 이전 지적(04-프론트엔드리뷰 HIGH 3) — 미해결, 2개 추가.
8. `src/lib/navigation/menu-routes.ts` — `(site)` 마케팅 라우트용인데 `(site)` 는 `archive/` 로 이동됨 (`ARCHITECTURE.md:36`). importer 0건. 삭제 대상.

**디자인 토큰**
9. raw 팔레트 vs 토큰 비율: admin 1621:566, academy 321:45, monitor 59:0, `/m` 46:145 (유일하게 토큰 우세). `--brand-*` 변수 tsx 참조 0건. 이전 지적(REVIEW_UI 약점 1) — 미해결. 개선안: 전면 교체 금지; 신규/수정 파일에서만 `text-muted-foreground`/`bg-card`/`text-destructive` 사용, 상태색은 `constants/attendance.ts` 처럼 config 에 모으기.
10. 다크모드: `globals.css:5,137` 에 `.dark` 변형·토큰 있으나 `.dark` 를 붙이는 코드 0건, `dark:` 는 `components/ui/*` 6파일만. 의도가 미지원이면 문제 없음 — 다만 raw 팔레트 1600개는 다크모드 도입 시 전부 깨짐.

**폼 UX**
11. 토스트: `sonner` 직접 import 32파일 / `lib/ui/toast` 래퍼 6파일, `toast.success|error(` 직접 호출 113건. 이전 지적(REVIEW_UI 8.1) — 미해결. 래퍼는 duration 6000/8000 고정이라 두 경로 체감 시간이 다름.
12. `window.confirm` 4곳(`LevelDropdown.tsx:81`, `ReportCardReplyForm.tsx:43,84`, `TeacherReportClient.tsx:180`) — 나머지는 `ConfirmDialog`. 개선안: 4곳 교체.
13. 에러 표시: `role="alert"` 5건 vs `text-red-500/600` 메시지 77건. 개선안: `FormGroup`(12파일 사용 중) 의 error 슬롯으로 몰기.
14. `useFormStatus` 0, `useActionState` 2 (AddStudentForm/AddTeacherForm), 나머지는 `useTransition` 19파일. pending 자체는 잘 처리됨(onSubmit 폼 7개 모두 disabled 있음) — 패턴만 두 갈래.

**로딩·빈 상태**
15. `loading.tsx` 없는 admin 라우트 8개 — 이전 지적(04-프론트엔드리뷰 MEDIUM 1) **미해결** (아래 표). academy 도 11개 중 4개만 있음.
16. 빈 상태: `EmptyState` 사용 2파일 vs "없습니다" 하드코딩 89줄. 이전 지적(REVIEW_UI 7.3) — 미해결.
17. no-op `<Suspense>` (fallback 없음) `homework/page.tsx:97`, `today/page.tsx:31` — 이전 지적 미해결.
18. `not-found.tsx` 전무 (루트 포함). 404 가 Next 기본 영문 화면. 개선안: `src/app/not-found.tsx` 하나, `ErrorScreen` 재사용.

**접근성**
19. 아이콘만 있는 `<button>` 중 aria-label 없음 4곳: `StudentAttendanceTab.tsx:291` (2), `AfterschoolPageClient.tsx`, `BusStaffMonitor.tsx`. lucide 아이콘 버튼은 전부 라벨 있음 — 양호.
20. `MonitorBusCard.tsx:241,307` 승하차 상태 이모지만(✅🚌⬜🔴) — 이전 지적(04 MEDIUM 5) **미해결**. 이모지 총 49줄 중 aria-hidden 없는 것 다수 (`ClassScheduleManager.tsx:54-56` 그룹 아이콘 등).
21. `PortalNav.tsx` 탭에 `aria-current` 없음, 활성 탭 자동 스크롤 없음 — 이전 지적(REVIEW_UI 5.2) 미해결. `MobileAttendanceClient` 탭 `role="tab"` 없음 — 이전 지적 미해결 (전체 `role="tab"` 4건만).
22. `SeriesEditorModal.tsx:120` 유일하게 남은 raw 모달 — `role`/Escape/FocusScope 없음. 개선안: `components/overlays/Modal` 로 교체 (나머지 복붙 모달은 모두 정리됨).
23. 출결 배지는 색+라벨 둘 다 표시(`StudentAttendanceTab.tsx:284-286`) — 양호. 단 `ReservationDashboard.tsx:487` 은 `badgeClass` 만 적용하고 라벨 유무 미확인(추정).

**반응형**
24. `proxy.ts:12-14` 는 `/admin` 루트만 `/m` 으로 보냄 → 모바일에서 `/admin/students` 등 하위 경로는 데스크톱 UI. `AdminMobileHeader` 드로어로 접근 가능하나 다음은 깨짐 추정: `overflow-x-auto` 없는 테이블 3개 (`reports/page.tsx:129`, `ReportTranslateManager.tsx`, `TrashView.tsx:69`), 고정폭 `w-[200px]` 사이드 컬럼(`StudentSelectedView.tsx:193`, `TeacherInfoCard.tsx`, `NoticesManager.tsx`), `StudentBusTab.tsx` 의 `min-w-[120/140px]` 셀.
25. `/m` 홈 카드 7개 = today·attendance·homework·reading·bus-change·bus-check·bus-monitor. `/m/bus-check` 는 `/bus` 구역 컴포넌트를 쓰고 `/admin/bus` 와 다른 UI (`BusStaffMonitor` vs `BusDashboard`) — 같은 기능의 두 화면.

**내비게이션**
26. 메뉴 ↔ 라우트 대조: 메뉴에 없는 페이지 `/admin/lunch`, `/admin/lunch/settings`, `/admin/students/classes`(stub), `/admin/reading/[studentId]`; 라우트 없는 메뉴 `academy/*/notices` 2개. `/lunch-monitor` 링크 0건, `/bus-monitor` 는 `/m/page.tsx` 만.
27. breadcrumb 없음 (`Breadcrumb` 컴포넌트 미사용), `router.back` 0건. `/m` 하위는 모두 `href="/m"` 뒤로 링크로 통일 — 양호. academy 는 뒤로가기 수단 없음(탭만).

**텍스트·날짜**
28. 요일 배열 중복: `date-kst.ts` 의 `KST_DAY_LABELS` 와 `constants/date.ts` 의 `WEEKDAY_NAMES_5/7` 이 있는데 `["일","월",…]`/`["월","화",…]` 리터럴이 11파일에 재선언 (`AdminBusChangeDnD.tsx`, `BusDashboard.tsx`, `bus/export/route.ts`, `GroupTimetableGrid.tsx`, `TeacherAcademyTimetable.tsx`, `stop-validation.ts`, `lunch/rotation.ts` 등). 개선안: 두 상수 중 하나로 통일 후 import.
29. 날짜 포맷: `formatDateKst` 계열 사용 7파일 vs `getMonth()+1` 수동 조합 7건 vs `toLocaleDateString` 3건(`useAttendanceEditor.ts:30`, `StudentSearchPanel.tsx:49`, `admin/page.tsx:234` — 서버·클라 timezone 불일치 가능). 개선안: `date-kst.ts` 로 통일.
30. `teacher-labels.ts` 한/영 라벨 세트가 있는데 teacher 컴포넌트 9개 중 4개만 사용. `TeacherAcademyTimetable.tsx`, `TeacherNav.tsx` 는 `teacherType` 받고도 문구 하드코딩.

**클라이언트 상태**
31. URL 쿼리 필터는 5파일만(`ClassesPageClient`, `ClassHomeworkManageTab`, `TextbooksPageClient`, `AdminListSidebar`, `LoginForm`). `useState` 필터로 새로고침 시 사라지는 대표: `BusStudentAssignmentManager.tsx:71-72` (search·groupFilter), `ReservationDashboard.tsx:120` (tab), `MobileHomeworkClient.tsx:72-98` (mode·반·요일·그룹·레벨 7개). 개선안: tab 류만 `?tab=` 로 (ClassesPageClient 패턴 재사용).

## 🟢
- `ErrorScreen.tsx:30` 여전히 raw `<button>` — 이전 지적(REVIEW_UI 약점 4) 미해결. `(monitor)/error.tsx` 는 ErrorScreen 도 안 쓰고 별도 버튼.
- `BusStudentAssignmentManager.tsx:669` `<div onClick>` 백드롭 (프로젝트 유일) — `aria-hidden` 추가.
- `MobileAttendanceClient.tsx:183,189` FAB 와 에러 박스 `fixed bottom` 겹침 — 이전 지적 미해결.
- `/m/page.tsx` 카드가 `/admin` 대시보드 카드와 별도 정의 — 작은 중복.
- loading.tsx 가 `SkeletonList`/`SkeletonTable`/`LoadingState`/`animate-pulse` 직접 작성 네 갈래 (`lunch/loading.tsx`, `lunch-monitor/loading.tsx`).

## loading / error / not-found 유무

| 세그먼트 | loading | error | not-found |
|---|---|---|---|
| `/` 루트 | ✗ | ✓ | ✗ |
| `/admin` (대시보드) | ✓ | ✓ | ✗ |
| admin: afterschool·bus·classes·lunch·notices·reports·students·teachers·timetable | ✓ | (상위) | ✗ |
| admin: **attendance·closed-days·homework·lunch/settings·reading·reading/[id]·reservations·students/classes·today·weekly-sentences** | ✗ | (상위) | ✗ |
| `/m/*` (7) | ✗ 전부 | (admin error 공유 안 됨 → 루트) | ✗ |
| academy: student·student/reports·teacher·teacher/reports·teacher/timetable | ✓ | ✓(academy) | ✗ |
| academy: student/bus·homework·reading·timetable, teacher/attendance·bus·classes·homework·reading·reading/[id] | ✗ | ✓(academy) | ✗ |
| monitor: bus-monitor·lunch-monitor | ✓ | ✓ | ✗ |
| `/bus`, `/dashboard`, `/login` | ✗ | ✓/루트/루트 | ✗ |

## `/admin` vs `/m` 기능 커버리지

| 기능 | /admin | /m | 코드 공유 |
|---|---|---|---|
| 오늘 수업 | ✓ | ✓ | `TodayPageClient` 공유 |
| 출결 | ✓ | ✓ | `useAttendanceEditor`·`StudentSearchPanel` 공유 |
| 숙제 | ✓ | ✓ | `HomeworkBoard`·`ClassUnitProgressList` 공유, 필터 UI 는 `MobileHomeworkClient` 별도 581줄 |
| Raz 리딩 (+학생 상세) | ✓ (상세 링크 없음) | ✓ (상세 링크 있음) | `BookGrid` 공유 |
| 버스 당일변경 | ✓ | ✓ | `AdminBusChangeDnD` 공유 |
| 승하차 체크 | ✓ `BusDashboard` | ✓ `BusStaffMonitor` | **비공유, 다른 UI** |
| 버스 모니터 링크 | ✗ | ✓ | — |
| 학생·교사·반·방과후 관리 | ✓ | ✗ | — |
| 시간표·쉬는날·주간문장 | ✓ | ✗ | — |
| 예약 현황·리포트카드·공지 | ✓ | ✗ | — |
| 급식 | ✓ (메뉴 없음) | ✗ | — |

## 잘 되어 있는 점
1. 공용 `Modal`(FocusScope·Escape·aria-modal) 과 `ConfirmDialog` 가 정착해 복붙 모달이 `SeriesEditorModal` 1개로 줄었다 — 이전 리뷰 High 항목 실질 해결.
2. `/m` 은 `/admin` 의 클라이언트 컴포넌트·훅을 import 로 재사용하고(독립 구현은 bus-check 하나), 토큰 색상 비율도 유일하게 raw 보다 높다.
3. `<img>` 2곳 모두 alt 있음, `AdminMobileHeader` 드로어 aria-label 3종, 출결 배지는 색+텍스트 병기, 폼 pending 은 `useTransition` 으로 빠짐없이 처리.

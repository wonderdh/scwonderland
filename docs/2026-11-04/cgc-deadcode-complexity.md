# CGC 기반 dead code · 복잡도 분석 (2026-11-04)

## 방법

1. CodeGraphContext(CGC) 그래프에서 `src/` 안의 함수 중 **호출 관계(CALLS)가 하나도 없는 함수** 478개를 뽑음.
2. CGC 는 `<Foo />` 같은 JSX 사용과 이벤트 핸들러 참조를 "호출" 로 세지 않아 오탐이 많으므로,
   후보 중 **export 된 함수·상수**만 대상으로 소스 전체(`src/`, `scripts/`)를 단어 단위로 재검색.
   주석·문자열(로그 메시지, JSDoc) 안의 언급은 사용으로 치지 않음.
3. 제외: `archive/`, `database.generated.ts`, `components/ui/`(shadcn), Next.js 진입 파일
   (`page/layout/loading/error/route/robots/sitemap/proxy`).
4. 복잡도는 CGC 가 색인 시 계산한 cyclomatic complexity 그대로 사용.

검증 스크립트: 세션 scratchpad `verify-dead.py` (프로젝트에 넣지 않음).

## 1. Dead code — 코드 어디서도 안 쓰임: 55개, 약 1,300줄

### Server Actions (31개, 약 860줄)

| 파일 | 함수 | 줄 |
|---|---|---|
| actions/afterschool-actions.ts | removeAfterschoolStudent, listAvailableStudents, bulkUpdateEnrollmentDays | 123 |
| actions/attendance-actions.ts | getClassAttendanceByDate | 40 |
| actions/bus/_helpers.ts | isStopServed, isStopServedByBus | 20 |
| actions/bus/assignment-actions.ts | deleteStudentBusDefault | 19 |
| actions/bus/board-actions.ts | boardBusStudent, unboardBusStudent, checkBusStudent, uncheckBusStudent | 144 |
| actions/bus/change-actions.ts | listPendingChangeRequests | 4 |
| actions/bus/master-actions.ts | listBusStopSchedules | 22 |
| actions/class-actions.ts | removeStudentFromClass, listClassesWithStudentIds | 60 |
| actions/class-textbook-actions.ts | updateStudentTextbookDays, listStudentScheduleByMonth | 41 |
| actions/homework-unit-actions.ts | listUnitProgressByClass(stub), markUnit, clearUnit | 97 |
| actions/notice-actions.ts | getNoticeWithAttachments | 17 |
| actions/publisher-actions.ts | getPublisher | 15 |
| actions/report-actions.ts | importTranslations | 33 |
| actions/run-action.ts | runAction (도입만 되고 채택 0건) | 36 |
| actions/schedule-actions.ts | addClassScheduleBatch, getStudentTimetableEditable, deleteStudentSchedule | 50 |
| actions/series-actions.ts | getSeries | 15 |
| actions/textbook-actions.ts | getTextbook | 15 |
| actions/user-actions.ts | bulkResetStudentPasswords | 29 |
| actions/weekly-sentence-actions.ts | getCurrentWeeklySentences (archive 홈페이지에서만 사용) | 28 |

### 컴포넌트 (4개, 약 400줄)

| 파일 | 컴포넌트 | 줄 |
|---|---|---|
| components/forms/AudioRecorder.tsx | AudioRecorder (파일 전체) | 191 |
| components/forms/FileUpload.tsx | FileUpload (파일 전체) | 119 |
| components/forms/SeriesPicker.tsx | SeriesPicker (NewSeriesModal 포함, 파일 전체) | 139 |
| students/_components/ReportCardReadView.tsx | ReportCardReadView (파일 전체) | 70 |

### lib 유틸·상수 (20개, 약 100줄)

| 파일 | 항목 |
|---|---|
| lib/navigation/menu-routes.ts | menuIdToLabel, getMenuItemHref, getDefaultMenuItemHref, getCategoryItemLabels, getMenuIdFromPathname (archive 에서만 사용) |
| lib/ui/teacher-labels.ts | textbookLabels, batchUpdateLabels, noticeLabels, homeworkLabels, timetableLabels, busLabels |
| lib/utils/homework-schedule.ts | getStudentHomeworkDays, isHomeworkDayForStudent, getStudentMonthSchedule |
| lib/utils/date-kst.ts | formatDateTimeKst, formatTimeKst |
| lib/constants/attendance.ts | getStatusLabel |
| lib/constants/class.ts | getClassColor |
| lib/supabase/storage.ts | getFileCategory |
| lib/ui/toast.ts | toastInfo |

### 지우기 전 판단이 필요한 것

- `getCurrentWeeklySentences`, `getMenuIdFromPathname`: `archive/(site)` 홈페이지가 다시 살아나면 필요. `docs/homepage-request.md` 진행 여부에 따라 결정.
- `AudioRecorder`, `FileUpload`: 성적표 첨부용으로 만든 듯한데 현재 어디서도 안 씀. 기능 계획이 있으면 보관.
- `runAction`: 2026-07 / 2026-11 리뷰 보고서에서 "모든 액션이 이걸 쓰도록" 권고했던 헬퍼. 채택할 건지, 지울 건지 하나로 정리 필요.
- `listUnitProgressByClass`: 이미 `@auth-skip: 비활성 stub` 표시된 빈 함수.

## 2. export 만 불필요 — 같은 파일 안에서만 쓰임: 17개

`export` 키워드만 떼면 됨 (동작 변화 없음).

- components/bus/MonitorBusCard.tsx: ProgressBar
- components/forms/SeriesLevelPicker.tsx: NONE_SERIES_KEY
- components/homework/BoardStudentList.tsx: deriveTodayUnit, deriveProgress
- lib/auth/user-roles.ts: USER_ROLE_PRIORITY
- lib/bus/afterschool-sync.ts: AFTERSCHOOL_DISMISS_TIME_1, AFTERSCHOOL_DISMISS_TIME_2
- lib/bus/state.ts: BUS_CHANGE_TYPES, STUDENT_SUBMITTABLE_CHANGE_TYPES, BUS_REQUEST_STATUSES
- lib/lunch/rotation.ts: LUNCH_ROTATION_EPOCH, businessDaysBetween, rotateClassPair, rotateLeader, sortByEnglishName
- lib/navigation/menu-routes.ts: menuIdToPath, itemSlugs

## 3. 복잡도 (cyclomatic complexity)

`src/` 함수 985개 분포:

| 구간 | 개수 | 의미 |
|---|---|---|
| 10 초과 | 206 | 보통 "리팩토 고려" 기준선 |
| 20 초과 | 97 | 한 번에 머리에 안 들어오는 수준 |
| 50 초과 | 21 | 테스트·수정 모두 위험 |
| 100 초과 | 6 | 사실상 화면 하나가 함수 하나 |

### 상위 20

| 순위 | 함수 | 파일 | 복잡도 |
|---|---|---|---|
| 1 | AdminBusChangeDnD | admin/bus/_components/AdminBusChangeDnD.tsx | 163 |
| 2 | ClassHomeworkManageTab | admin/homework/_components/ClassHomeworkManageTab.tsx | 139 |
| 3 | BusStudentAssignmentManager | admin/bus/_components/BusStudentAssignmentManager.tsx | 136 |
| 4 | BusStopAssignmentManager | admin/bus/_components/BusStopAssignmentManager.tsx | 122 |
| 5 | MobileHomeworkClient | m/homework/_components/MobileHomeworkClient.tsx | 118 |
| 6 | getDailyBusManifest | admin/actions/bus/manifest-actions.ts | 102 |
| 7 | ClassScheduleManager | admin/classes/_components/ClassScheduleManager.tsx | 97 |
| 8 | ClassesManager | admin/classes/_components/ClassesManager.tsx | 87 |
| 9 | useTodayClassEditor | admin/today/_hooks/useTodayClassEditor.ts | 74 |
| 10 | StudentSearchPanel | admin/attendance/_components/StudentSearchPanel.tsx | 72 |
| 11 | TeacherReportClient | academy/teacher/_components/TeacherReportClient.tsx | 71 |
| 12 | listSeriesLevelProgress | admin/actions/homework-unit-actions.ts | 69 |
| 13 | ReservationDashboard | admin/reservations/_components/ReservationDashboard.tsx | 65 |
| 14 | BusChangeRequestsPanel | admin/bus/_components/BusChangeRequestsPanel.tsx | 64 |
| 15 | getUnitSchedule | lib/utils/homework-schedule.ts | 62 |
| 16 | BusStaffMonitor | app/bus/_components/BusStaffMonitor.tsx | 61 |
| 17 | FullOverviewPanel | admin/bus/_components/DropoffOverviewPanel.tsx | 60 |
| 18 | StudentBusTab | admin/students/_components/StudentBusTab.tsx | 60 |
| 19 | RequestCard | admin/bus/_components/BusChangeRequestsPanel.tsx | 58 |
| 20 | WeeklySentencesManager | admin/weekly-sentences/_components/WeeklySentencesManager.tsx | 58 |

읽는 법: React 컴포넌트는 조건부 렌더링(`&&`, 삼항)이 전부 분기로 잡혀 수치가 부풀어 보임.
그래도 상위 5개(100 초과)는 **승하차 관리 화면 3개 + 숙제 관리 2개**로 몰려 있고,
ponytail 감사 5번(큰 화면 통합 보류)에서 지목한 화면과 겹침. 그 화면을 고칠 때 함께 쪼개는 것이 맞음.

서버 쪽은 `getDailyBusManifest`(102) 와 `listSeriesLevelProgress`(69) 둘만 두드러짐. UI 가 아니라 순수 로직이라 테스트로 보호하기 쉬운 쪽부터.

## 권고

1. **dead code 55개 삭제**: 판단 필요 항목 4건(위 "지우기 전 판단") 빼고 바로 지워도 안전. tsc·lint 가 깨지면 그 자리에서 드러남.
2. **export 17개 제거**: 기계적 작업, 위험 0.
3. 복잡도는 지금 손대지 않고, 해당 화면 수정 요청이 들어올 때 "화면 하나 = 함수 하나" 구조를 쪼개기.

## 진행 상태 (2026-11-04)

- **dead code 54개 삭제 완료** (`getCurrentWeeklySentences` 만 사용자 결정으로 보존). 파일 7개 통삭제
  (AudioRecorder, FileUpload, FileList, SeriesPicker, ReportCardReadView, menu-routes, run-action).
- 삭제로 드러난 연쇄 dead code 도 함께 정리: `FileList`, `formatFileSize`, `daysInMonth`/`ymd`,
  `HomeworkDayInfo`/`StudentDayUnit(s)` 타입, `DAY_RANGE`, `StudentTimetableEditData`, `DATETIME_FORMATTER`/`TIME_FORMATTER`.
- 합계 약 1,880줄 삭제. tsc·lint(경고 0)·test 27·CI 정적 검사 3종 모두 통과.
- 보류: export 17개 제거(2번), 복잡도 상위 화면 분할(3번).

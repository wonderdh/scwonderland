# admin/actions 배럴 → 직접 import 분리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/app/(admin)/admin/actions.ts` 배럴(재export 전용)을 경유하는 44개 소비자 파일의 import 를 각 도메인 소스 파일(`./actions/<domain>-actions`)에서 직접 가져오도록 바꾸고, 사용처가 사라진 배럴 파일을 삭제한다.

**Architecture:** 배럴 `actions.ts` 는 로직이 한 줄도 없는 순수 re-export 파일이다. 따라서 "import 경로만" 바꾸는 순수 기계적 리팩토이며 런타임 동작/번들 시맨틱은 동일하다(서버 액션은 그대로 `"use server"` 소스에서 직접 import). 검증 게이트는 각 묶음마다 `pnpm type-check`(베이스라인 exit 0 확인됨), 마지막에 `pnpm build`. 테스트 코드가 없는 도메인이므로 `type-check` 통과가 "빨강→초록" 역할을 한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript (strict, isolatedModules), Tailwind v4, Supabase. 경로 alias `@/* → ./src/*`.

---

## 절대 규칙 (전체 구조 안 깨지게)

1. **소스 파일(`./actions/*-actions.ts`)은 절대 손대지 않는다.** export 추가/삭제/이동 없음. 오직 소비자의 import 문만 교체.
2. **alias 형태 유지**: 새 import 도 `@/app/(admin)/admin/actions/<file>` 형태로 쓴다(상대경로 금지). 기존 직접 import 들(`@/app/(admin)/admin/actions/lunch-actions` 등)과 동일 컨벤션.
3. **심볼 누락/오타 금지**: 아래 "심볼 → 소스 매핑 표"가 단일 진실 소스(SSOT). 각 파일의 교체 블록은 이 표에서 도출됨.
4. **type/value 혼합 주의**: `verbatimModuleSyntax` 는 꺼져 있으므로 `import { fn, type T } from "..."` 인라인 표기 허용. 기존 파일이 `import type {}` 를 따로 쓰면 그 스타일을 유지해도 무방하나, **소스 파일이 같으면 한 import 문으로 합친다**(중복 import 문 금지).
5. 각 Task 끝에서 `pnpm type-check` 가 **exit 0** 이어야만 commit. 실패하면 그 Task 안에서 고치고 다음으로 넘어가지 않는다.
6. 배럴 삭제(Task 9)는 1~8 이 모두 끝나고 배럴을 import 하는 파일이 0 개임을 grep 으로 확인한 뒤에만.

---

## 심볼 → 소스 매핑 표 (SSOT)

모든 경로 접두사: `@/app/(admin)/admin/actions/`

| 소스 파일 | export 심볼 (value) | export 타입 (type) |
|---|---|---|
| `dashboard-actions` | getDashboardStats, getTodayStats | — |
| `user-actions` | createStudent, createTeacher, listAdmins, listUsersByRole, getTeacherAssignmentCounts, getStudentLinkedCounts, deleteUserById, restoreUser, permanentlyDeleteUser, listDeletedUsers, updateStudentProfile, updateTeacherProfile, resetUserPassword, bulkResetStudentPasswords, listAllStudents | — |
| `report-actions` | getReportCard, listReportCardsByStudent, upsertReportCard, deleteReportCard, updateReportCardReply, listAllClassesReportStatus, listUntranslatedReports, translateReportCard | — |
| `class-actions` | listClassesWithDetails, listClassesForHomeworkPicker, getClassWithStudents, getStudentClasses, getAllClassStudentsFlat, createClass, updateClass, deleteClass, getClassLinkedCounts, addStudentToClass, removeStudentFromClass, batchUpdateClassStudents, listTeachersForSelect, listStudentsNotInClass, listClassesWithStudentIds | HomeworkClassPickerOption |
| `notice-actions` | listNotices, getNoticeWithAttachments, createNotice, updateNotice, deleteNotice | — |
| `attendance-actions` | listAttendanceRecords, recordAttendance, deleteAttendance, getAttendanceStats, getClassAttendanceByDate, getClassStudentsWithAttendance, bulkRecordAttendance, getStudentAttendanceByDate, bulkReserveAttendance | — |
| `schedule-actions` | listClassSchedules, addClassScheduleBatch, deleteClassSchedule, getStudentTimetable, getGroupTimetableGrid, addSingleClassSchedule, setClassScheduleSlot, getStudentTimetableEditable, deleteStudentSchedule | — |
| `timetable-actions` | listAcademyPeriods, createAcademyPeriod, updateAcademyPeriod, deleteAcademyPeriod | — |
| `bus-actions` | listAllActiveStudentNames, listBusNumbers, createBusNumber, updateBusNumber, deleteBusNumber, listBusTimeSlots, createBusTimeSlot, updateBusTimeSlot, deleteBusTimeSlot, getStudentBusDefaults, upsertStudentBusDefault, deleteStudentBusDefault, deleteStudentBusDefaults, getDailyBusManifest, listPendingChangeRequests, listAllChangeRequests, listChangeRequestsByDate, approveChangeRequest, rejectChangeRequest, getStudentChangeRequests, submitBusChangeRequest, cancelBusChangeRequest, boardBusStudent, unboardBusStudent, checkBusStudent, uncheckBusStudent, batchBusCheckRecord, listBusStops, createBusStop, updateBusStop, deleteBusStop, listBusStopDayAssignments, saveBusStopDayAssignments, listBusStopSchedulesBulk, saveBulkBusDefaults, getBulkBusDefaults, listBusStopSchedules, upsertBusStopSchedule, deleteBusStopSchedule, copyBusDayDataToOtherDays, getBusDayDataCounts, createAdminBusChange, updateAdminBusChange, getExistingBusChange, deleteAdminBusChange, getWeeklyDropoffExportData, bulkCreateBusChanges | — |
| `bus-staff` | createBusStaff, listBusStaff, updateBusStaff | — |
| `afterschool-actions` | getOrCreateAfterschoolClass, getAfterschoolEnrollments, enrollStudent, removeAfterschoolStudent, listAvailableStudents, bulkUpdateEnrollmentDays, listAfterschoolStudentIdsByDay, getStudentAfterschoolDetail, updateAfterschoolSecondPeriod, deleteAfterschoolEnrollmentDay | — |
| `weekly-sentence-actions` | getCurrentWeeklySentences, listAllWeeklySentences, upsertWeeklySentence, deleteWeeklySentence, bulkImportWeeklySentences, getWeeklySentenceConfig, updateWeeklySentenceConfig | — |
| `reservation-actions` | getUpcomingReservations | — |
| `textbook-actions` | listTextbooks, getTextbook, **createSeriesLevel, updateSeriesLevel, deleteSeriesLevel** | TextbookWithSeries |
| `series-actions` | listSeries, listAllSeries, getSeries, createSeries, updateSeries, deleteSeries, listSeriesLevels, listLevelsBySeries | SeriesWithPublisher, **SeriesLevelRow** |
| `publisher-actions` | listPublishers, listAllPublishers, getPublisher, createPublisher, updatePublisher, deletePublisher | — |
| `class-textbook-actions` | listClassTextbooks, assignClassTextbook, updateClassTextbookDays, unassignClassTextbook, listStudentTextbooks, assignStudentTextbook, updateStudentTextbookDays, unassignStudentTextbook, listStudentScheduleByMonth | ClassTextbookWithDetails, StudentTextbookWithDetails |
| `homework-unit-actions` | listUnitProgressByStudent, listUnitProgressByClass, listClassUnitProgressDetailed, listSeriesLevelProgress, markUnit, bulkMarkUnits, clearUnit, getAbsentStudentIds | UnitStatus, StudentTextbookUnits, StudentUnitProgressData, ClassUnitOverview, ClassUnitProgressDetailed, BoardStudent, SeriesLevelProgress |
| `closed-days-actions` | listAcademyClosedDays, addAcademyClosedDays, removeAcademyClosedDay | AcademyClosedDay |
| **`@/lib/utils/homework-schedule`** (배럴이 재export 하던 외부 모듈) | getUnitSchedule | StudentDayUnits, StudentDayUnit, UnitAssignment |
| **`@/lib/types`** (배럴이 재export 하던 외부 모듈) | — | DropoffExportRow, DropoffExportData |

> ⚠️ **함정 3종** (find-replace 로는 못 잡음):
> - `createSeriesLevel/updateSeriesLevel/deleteSeriesLevel` → `textbook-actions` (series 아님)
> - `SeriesLevelRow` 타입 → `series-actions`
> - `getUnitSchedule` → `@/lib/utils/homework-schedule` (actions 폴더 아님)

---

## Task 0: 베이스라인 확인

**Files:** (없음 — 확인만)

- [ ] **Step 1: 현재 배럴 소비자 수를 기록**

Run:
```bash
grep -rl 'from "@/app/(admin)/admin/actions"' src --include="*.ts" --include="*.tsx" | wc -l
```
Expected: `44`

- [ ] **Step 2: type-check 베이스라인이 깨끗한지 확인**

Run: `pnpm type-check`
Expected: 에러 0, exit 0. (만약 여기서 실패하면 이 리팩토와 무관한 기존 에러이므로 먼저 사용자에게 알린다.)

---

## Task 1: `src/components/` + `src/components/forms/` (6개)

**Files (Modify):**
- `src/components/forms/PublisherPicker.tsx:9`
- `src/components/forms/SeriesPicker.tsx:9`
- `src/components/homework/BoardStudentList.tsx:5`
- `src/components/homework/ClassUnitProgressList.tsx`
- `src/components/bus/DailyBusChanges.tsx:5`
- `src/components/homework/useHomeworkBoard.ts`

- [ ] **Step 1: PublisherPicker.tsx** — `import { listPublishers, createPublisher } from "@/app/(admin)/admin/actions";` 를 아래로 교체

```ts
import { listPublishers, createPublisher } from "@/app/(admin)/admin/actions/publisher-actions";
```

- [ ] **Step 2: SeriesPicker.tsx** — `import { listSeries, createSeries } from "@/app/(admin)/admin/actions";` 를 교체

```ts
import { listSeries, createSeries } from "@/app/(admin)/admin/actions/series-actions";
```

- [ ] **Step 3: BoardStudentList.tsx** — `import type { BoardStudent, StudentTextbookUnits } from "@/app/(admin)/admin/actions";` 를 교체

```ts
import type { BoardStudent, StudentTextbookUnits } from "@/app/(admin)/admin/actions/homework-unit-actions";
```

- [ ] **Step 4: ClassUnitProgressList.tsx** — barrel type import 블록을 교체

```ts
import type {
  ClassUnitProgressDetailed,
  UnitStatus,
} from "@/app/(admin)/admin/actions/homework-unit-actions";
```

- [ ] **Step 5: DailyBusChanges.tsx** — `import { listChangeRequestsByDate } from "@/app/(admin)/admin/actions";` 를 교체

```ts
import { listChangeRequestsByDate } from "@/app/(admin)/admin/actions/bus-actions";
```

- [ ] **Step 6: useHomeworkBoard.ts** — barrel 의 value 블록 + type 블록(2개)을 **homework-unit-actions 한 import 문**으로 합쳐 교체

```ts
import {
  listSeriesLevelProgress,
  bulkMarkUnits,
  getAbsentStudentIds,
  type BoardStudent,
  type StudentTextbookUnits,
  type UnitStatus,
  type SeriesLevelProgress,
} from "@/app/(admin)/admin/actions/homework-unit-actions";
```

- [ ] **Step 7: type-check**

Run: `pnpm type-check`
Expected: exit 0

- [ ] **Step 8: Commit**

```bash
git add src/components/forms/PublisherPicker.tsx src/components/forms/SeriesPicker.tsx src/components/homework/BoardStudentList.tsx src/components/homework/ClassUnitProgressList.tsx src/components/bus/DailyBusChanges.tsx src/components/homework/useHomeworkBoard.ts
git commit -m "refactor(actions): components 의 admin/actions 배럴 import 를 직접 import 로 분리"
```

---

## Task 2: `(site)` + `(monitor)` + `bus/` (4개)

**Files (Modify):**
- `src/app/(site)/page.tsx:4`
- `src/app/(monitor)/bus-monitor/BusMonitorClient.tsx:6`
- `src/app/(monitor)/bus-monitor/page.tsx:2`
- `src/app/bus/_components/BusStaffMonitor.tsx`

- [ ] **Step 1: (site)/page.tsx**

```ts
import { getCurrentWeeklySentences } from "@/app/(admin)/admin/actions/weekly-sentence-actions";
```

- [ ] **Step 2: bus-monitor/BusMonitorClient.tsx**

```ts
import { getDailyBusManifest } from "@/app/(admin)/admin/actions/bus-actions";
```

- [ ] **Step 3: bus-monitor/page.tsx**

```ts
import { listBusTimeSlots, getDailyBusManifest } from "@/app/(admin)/admin/actions/bus-actions";
```

- [ ] **Step 4: BusStaffMonitor.tsx** — barrel 블록 교체

```ts
import {
  getDailyBusManifest,
  batchBusCheckRecord,
} from "@/app/(admin)/admin/actions/bus-actions";
```

- [ ] **Step 5: type-check**

Run: `pnpm type-check`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add "src/app/(site)/page.tsx" "src/app/(monitor)/bus-monitor/BusMonitorClient.tsx" "src/app/(monitor)/bus-monitor/page.tsx" "src/app/bus/_components/BusStaffMonitor.tsx"
git commit -m "refactor(actions): site·monitor·bus 화면의 배럴 import 직접화"
```

---

## Task 3: `academy/student` (5개)

**Files (Modify):**
- `src/app/academy/student/_components/DashboardWidgets.tsx`
- `src/app/academy/student/_components/ReportCardReplyForm.tsx:3`
- `src/app/academy/student/bus/StudentBusClient.tsx`
- `src/app/academy/student/homework/page.tsx:3`
- `src/app/academy/student/reports/page.tsx`

- [ ] **Step 1: DashboardWidgets.tsx**

```ts
import { getAttendanceStats } from "@/app/(admin)/admin/actions/attendance-actions";
```

- [ ] **Step 2: ReportCardReplyForm.tsx**

```ts
import { updateReportCardReply } from "@/app/(admin)/admin/actions/report-actions";
```

- [ ] **Step 3: StudentBusClient.tsx** — barrel 블록 교체(전부 bus-actions)

```ts
import {
  getStudentBusDefaults,
  getStudentChangeRequests,
  listBusNumbers,
  listBusTimeSlots,
  submitBusChangeRequest,
  cancelBusChangeRequest,
} from "@/app/(admin)/admin/actions/bus-actions";
```

- [ ] **Step 4: student/homework/page.tsx**

```ts
import { listUnitProgressByStudent } from "@/app/(admin)/admin/actions/homework-unit-actions";
```

- [ ] **Step 5: student/reports/page.tsx**

```ts
import {
  getReportCard,
  listReportCardsByStudent,
} from "@/app/(admin)/admin/actions/report-actions";
```

- [ ] **Step 6: type-check**

Run: `pnpm type-check`
Expected: exit 0

- [ ] **Step 7: Commit**

```bash
git add src/app/academy/student/_components/DashboardWidgets.tsx src/app/academy/student/_components/ReportCardReplyForm.tsx src/app/academy/student/bus/StudentBusClient.tsx src/app/academy/student/homework/page.tsx src/app/academy/student/reports/page.tsx
git commit -m "refactor(actions): academy/student 화면의 배럴 import 직접화"
```

---

## Task 4: `academy/teacher` (3개) — getUnitSchedule 함정 포함

**Files (Modify):**
- `src/app/academy/teacher/_components/TeacherReportClient.tsx`
- `src/app/academy/teacher/homework/_components/TeacherTextbooksClient.tsx`
- `src/app/academy/teacher/homework/page.tsx`

- [ ] **Step 1: TeacherReportClient.tsx**

```ts
import {
  getReportCard,
  upsertReportCard,
  deleteReportCard,
} from "@/app/(admin)/admin/actions/report-actions";
```

- [ ] **Step 2: TeacherTextbooksClient.tsx** — barrel value 블록 + type 블록을 **3개 import** 로 분해. `getUnitSchedule` 는 actions 폴더가 아니라 `@/lib/utils/homework-schedule` 에서!

```ts
import {
  updateClassTextbookDays,
  type ClassTextbookWithDetails,
} from "@/app/(admin)/admin/actions/class-textbook-actions";
import {
  listClassUnitProgressDetailed,
  type ClassUnitProgressDetailed,
} from "@/app/(admin)/admin/actions/homework-unit-actions";
import { getUnitSchedule } from "@/lib/utils/homework-schedule";
```

- [ ] **Step 3: teacher/homework/page.tsx** — 3개 소스로 분해

```ts
import { listClassTextbooks } from "@/app/(admin)/admin/actions/class-textbook-actions";
import { listClassUnitProgressDetailed } from "@/app/(admin)/admin/actions/homework-unit-actions";
import { listAcademyClosedDays } from "@/app/(admin)/admin/actions/closed-days-actions";
```

- [ ] **Step 4: type-check**

Run: `pnpm type-check`
Expected: exit 0 (특히 `getUnitSchedule` 가 homework-schedule 에서 정상 resolve 되는지 확인)

- [ ] **Step 5: Commit**

```bash
git add src/app/academy/teacher/_components/TeacherReportClient.tsx src/app/academy/teacher/homework/_components/TeacherTextbooksClient.tsx src/app/academy/teacher/homework/page.tsx
git commit -m "refactor(actions): academy/teacher 화면 배럴 import 직접화 (getUnitSchedule 는 lib/utils 로)"
```

---

## Task 5: `admin/attendance` + `closed-days` + `hooks` + `reports` (7개)

**Files (Modify):**
- `src/app/(admin)/admin/attendance/_components/StudentSearchPanel.tsx`
- `src/app/(admin)/admin/attendance/hooks/useAttendanceEditor.ts:5`
- `src/app/(admin)/admin/attendance/page.tsx:1`
- `src/app/(admin)/admin/closed-days/_components/ClosedDaysClient.tsx`
- `src/app/(admin)/admin/closed-days/page.tsx:1`
- `src/app/(admin)/admin/hooks/usePasswordReset.ts:4`
- `src/app/(admin)/admin/reports/_components/ReportTranslateManager.tsx:6`

- [ ] **Step 1: StudentSearchPanel.tsx**

```ts
import {
  getStudentAttendanceByDate,
  recordAttendance,
  bulkReserveAttendance,
} from "@/app/(admin)/admin/actions/attendance-actions";
```

- [ ] **Step 2: useAttendanceEditor.ts**

```ts
import { getClassStudentsWithAttendance, bulkRecordAttendance } from "@/app/(admin)/admin/actions/attendance-actions";
```

- [ ] **Step 3: attendance/page.tsx** — class + user 분해

```ts
import { listClassesWithDetails } from "@/app/(admin)/admin/actions/class-actions";
import { listAllStudents } from "@/app/(admin)/admin/actions/user-actions";
```

- [ ] **Step 4: ClosedDaysClient.tsx** — value+type 한 import 로(전부 closed-days)

```ts
import {
  listAcademyClosedDays,
  addAcademyClosedDays,
  removeAcademyClosedDay,
  type AcademyClosedDay,
} from "@/app/(admin)/admin/actions/closed-days-actions";
```

- [ ] **Step 5: closed-days/page.tsx**

```ts
import { listAcademyClosedDays } from "@/app/(admin)/admin/actions/closed-days-actions";
```

- [ ] **Step 6: usePasswordReset.ts**

```ts
import { resetUserPassword } from "@/app/(admin)/admin/actions/user-actions";
```

- [ ] **Step 7: ReportTranslateManager.tsx**

```ts
import { translateReportCard } from "@/app/(admin)/admin/actions/report-actions";
```

- [ ] **Step 8: type-check**

Run: `pnpm type-check`
Expected: exit 0

- [ ] **Step 9: Commit**

```bash
git add "src/app/(admin)/admin/attendance/_components/StudentSearchPanel.tsx" "src/app/(admin)/admin/attendance/hooks/useAttendanceEditor.ts" "src/app/(admin)/admin/attendance/page.tsx" "src/app/(admin)/admin/closed-days/_components/ClosedDaysClient.tsx" "src/app/(admin)/admin/closed-days/page.tsx" "src/app/(admin)/admin/hooks/usePasswordReset.ts" "src/app/(admin)/admin/reports/_components/ReportTranslateManager.tsx"
git commit -m "refactor(actions): admin attendance·closed-days·hooks·reports 배럴 import 직접화"
```

---

## Task 6: `admin/homework/_components` (7개) — series/textbook 함정 포함

**Files (Modify):**
- `src/app/(admin)/admin/homework/_components/AssignClassHomeworkModal.tsx`
- `src/app/(admin)/admin/homework/_components/ClassHomeworkManageTab.tsx`
- `src/app/(admin)/admin/homework/_components/EditClassHomeworkModal.tsx`
- `src/app/(admin)/admin/homework/_components/LevelDropdown.tsx`
- `src/app/(admin)/admin/homework/_components/SeriesCard.tsx`
- `src/app/(admin)/admin/homework/_components/SeriesCardsManager.tsx`
- `src/app/(admin)/admin/homework/_components/SeriesEditorModal.tsx`

- [ ] **Step 1: AssignClassHomeworkModal.tsx** — value(class-textbook) + type(textbook) 분해. 기존 2개 barrel 줄을 모두 교체

```ts
import { assignClassTextbook } from "@/app/(admin)/admin/actions/class-textbook-actions";
import type { TextbookWithSeries } from "@/app/(admin)/admin/actions/textbook-actions";
```

- [ ] **Step 2: ClassHomeworkManageTab.tsx** — value 블록 + type 블록을 5개 소스로 분해

```ts
import {
  listClassUnitProgressDetailed,
  bulkMarkUnits,
  getAbsentStudentIds,
  type ClassUnitProgressDetailed,
  type UnitStatus,
} from "@/app/(admin)/admin/actions/homework-unit-actions";
import {
  listClassTextbooks,
  unassignClassTextbook,
  type ClassTextbookWithDetails,
} from "@/app/(admin)/admin/actions/class-textbook-actions";
import { listAcademyClosedDays } from "@/app/(admin)/admin/actions/closed-days-actions";
import type { HomeworkClassPickerOption } from "@/app/(admin)/admin/actions/class-actions";
import type { TextbookWithSeries } from "@/app/(admin)/admin/actions/textbook-actions";
```

- [ ] **Step 3: EditClassHomeworkModal.tsx** — 둘 다 class-textbook, 한 import 로 합침

```ts
import {
  updateClassTextbookDays,
  type ClassTextbookWithDetails,
} from "@/app/(admin)/admin/actions/class-textbook-actions";
```

- [ ] **Step 4: LevelDropdown.tsx** — ⚠️ `createSeriesLevel/updateSeriesLevel/deleteSeriesLevel` 는 **textbook-actions**, `SeriesLevelRow` 타입은 **series-actions**

```ts
import {
  createSeriesLevel,
  updateSeriesLevel,
  deleteSeriesLevel,
} from "@/app/(admin)/admin/actions/textbook-actions";
import type { SeriesLevelRow } from "@/app/(admin)/admin/actions/series-actions";
```

- [ ] **Step 5: SeriesCard.tsx** — 둘 다 series

```ts
import type {
  SeriesWithPublisher,
  SeriesLevelRow,
} from "@/app/(admin)/admin/actions/series-actions";
```

- [ ] **Step 6: SeriesCardsManager.tsx** — value+type 모두 series, 한 import 로 합침

```ts
import {
  deleteSeries,
  listSeriesLevels,
  type SeriesWithPublisher,
  type SeriesLevelRow,
} from "@/app/(admin)/admin/actions/series-actions";
```

- [ ] **Step 7: SeriesEditorModal.tsx** — value+type 모두 series, 한 import 로 합침

```ts
import {
  createSeries,
  updateSeries,
  type SeriesWithPublisher,
  type SeriesLevelRow,
} from "@/app/(admin)/admin/actions/series-actions";
```

- [ ] **Step 8: type-check**

Run: `pnpm type-check`
Expected: exit 0 (특히 LevelDropdown 의 createSeriesLevel 가 textbook-actions 에서 resolve 되는지 확인)

- [ ] **Step 9: Commit**

```bash
git add "src/app/(admin)/admin/homework/_components/AssignClassHomeworkModal.tsx" "src/app/(admin)/admin/homework/_components/ClassHomeworkManageTab.tsx" "src/app/(admin)/admin/homework/_components/EditClassHomeworkModal.tsx" "src/app/(admin)/admin/homework/_components/LevelDropdown.tsx" "src/app/(admin)/admin/homework/_components/SeriesCard.tsx" "src/app/(admin)/admin/homework/_components/SeriesCardsManager.tsx" "src/app/(admin)/admin/homework/_components/SeriesEditorModal.tsx"
git commit -m "refactor(actions): admin/homework 컴포넌트 배럴 import 직접화 (series-level 은 textbook-actions)"
```

---

## Task 7: `admin/today` + `reservations` + `weekly-sentences` (7개)

**Files (Modify):**
- `src/app/(admin)/admin/today/_components/ClassCard.tsx:6`
- `src/app/(admin)/admin/today/_components/TodayPageClient.tsx`
- `src/app/(admin)/admin/today/_hooks/useTodayClassEditor.ts`
- `src/app/(admin)/admin/reservations/_components/ReservationDashboard.tsx`
- `src/app/(admin)/admin/reservations/page.tsx`
- `src/app/(admin)/admin/weekly-sentences/_components/WeeklySentencesManager.tsx`
- `src/app/(admin)/admin/weekly-sentences/page.tsx`

- [ ] **Step 1: ClassCard.tsx**

```ts
import type { HomeworkClassPickerOption } from "@/app/(admin)/admin/actions/class-actions";
```

- [ ] **Step 2: TodayPageClient.tsx** — type 2개를 class + textbook 으로 분해

```ts
import type { HomeworkClassPickerOption } from "@/app/(admin)/admin/actions/class-actions";
import type { TextbookWithSeries } from "@/app/(admin)/admin/actions/textbook-actions";
```

- [ ] **Step 3: useTodayClassEditor.ts** — value 블록 + type 블록을 hu + attendance + class 로 분해

```ts
import {
  listClassUnitProgressDetailed,
  bulkMarkUnits,
  type ClassUnitProgressDetailed,
  type UnitStatus,
} from "@/app/(admin)/admin/actions/homework-unit-actions";
import {
  getClassStudentsWithAttendance,
  bulkRecordAttendance,
} from "@/app/(admin)/admin/actions/attendance-actions";
import type { HomeworkClassPickerOption } from "@/app/(admin)/admin/actions/class-actions";
```

- [ ] **Step 4: ReservationDashboard.tsx** — attendance + bus 분해

```ts
import {
  bulkReserveAttendance,
  deleteAttendance,
} from "@/app/(admin)/admin/actions/attendance-actions";
import {
  bulkCreateBusChanges,
  deleteAdminBusChange,
} from "@/app/(admin)/admin/actions/bus-actions";
```

- [ ] **Step 5: reservations/page.tsx** — reservation + user + bus 분해

```ts
import { getUpcomingReservations } from "@/app/(admin)/admin/actions/reservation-actions";
import { listAllStudents } from "@/app/(admin)/admin/actions/user-actions";
import {
  listBusNumbers,
  listBusTimeSlots,
} from "@/app/(admin)/admin/actions/bus-actions";
```

- [ ] **Step 6: WeeklySentencesManager.tsx**

```ts
import {
  upsertWeeklySentence,
  deleteWeeklySentence,
  bulkImportWeeklySentences,
  updateWeeklySentenceConfig,
} from "@/app/(admin)/admin/actions/weekly-sentence-actions";
```

- [ ] **Step 7: weekly-sentences/page.tsx**

```ts
import {
  listAllWeeklySentences,
  getWeeklySentenceConfig,
} from "@/app/(admin)/admin/actions/weekly-sentence-actions";
```

- [ ] **Step 8: type-check**

Run: `pnpm type-check`
Expected: exit 0

- [ ] **Step 9: Commit**

```bash
git add "src/app/(admin)/admin/today/_components/ClassCard.tsx" "src/app/(admin)/admin/today/_components/TodayPageClient.tsx" "src/app/(admin)/admin/today/_hooks/useTodayClassEditor.ts" "src/app/(admin)/admin/reservations/_components/ReservationDashboard.tsx" "src/app/(admin)/admin/reservations/page.tsx" "src/app/(admin)/admin/weekly-sentences/_components/WeeklySentencesManager.tsx" "src/app/(admin)/admin/weekly-sentences/page.tsx"
git commit -m "refactor(actions): admin today·reservations·weekly-sentences 배럴 import 직접화"
```

---

## Task 8: `admin/m` 모바일 (5개)

**Files (Modify):**
- `src/app/(admin)/m/attendance/page.tsx:1`
- `src/app/(admin)/m/bus-change/page.tsx`
- `src/app/(admin)/m/homework/page.tsx`
- `src/app/(admin)/m/homework/_components/MobileHomeworkClient.tsx`
- `src/app/(admin)/m/today/page.tsx`

- [ ] **Step 1: m/attendance/page.tsx** — class + user 분해

```ts
import { listClassesWithDetails } from "@/app/(admin)/admin/actions/class-actions";
import { listAllStudents } from "@/app/(admin)/admin/actions/user-actions";
```

- [ ] **Step 2: m/bus-change/page.tsx** — 전부 bus

```ts
import {
  listAllActiveStudentNames,
  listBusStops,
  listBusTimeSlots,
} from "@/app/(admin)/admin/actions/bus-actions";
```

- [ ] **Step 3: m/homework/page.tsx** — class + hu + textbook + series 분해

```ts
import {
  listClassesForHomeworkPicker,
  listTeachersForSelect,
} from "@/app/(admin)/admin/actions/class-actions";
import {
  listClassUnitProgressDetailed,
  getAbsentStudentIds,
} from "@/app/(admin)/admin/actions/homework-unit-actions";
import { listTextbooks } from "@/app/(admin)/admin/actions/textbook-actions";
import {
  listSeries,
  listLevelsBySeries,
} from "@/app/(admin)/admin/actions/series-actions";
```

- [ ] **Step 4: MobileHomeworkClient.tsx** — value 블록 + type 블록을 hu + class + textbook 분해

```ts
import {
  listClassUnitProgressDetailed,
  bulkMarkUnits,
  getAbsentStudentIds,
  type ClassUnitProgressDetailed,
  type UnitStatus,
} from "@/app/(admin)/admin/actions/homework-unit-actions";
import type { HomeworkClassPickerOption } from "@/app/(admin)/admin/actions/class-actions";
import type { TextbookWithSeries } from "@/app/(admin)/admin/actions/textbook-actions";
```

- [ ] **Step 5: m/today/page.tsx** — class + hu + textbook 분해

```ts
import { listClassesForHomeworkPicker } from "@/app/(admin)/admin/actions/class-actions";
import { getAbsentStudentIds } from "@/app/(admin)/admin/actions/homework-unit-actions";
import { listTextbooks } from "@/app/(admin)/admin/actions/textbook-actions";
```

- [ ] **Step 6: type-check**

Run: `pnpm type-check`
Expected: exit 0

- [ ] **Step 7: Commit**

```bash
git add "src/app/(admin)/m/attendance/page.tsx" "src/app/(admin)/m/bus-change/page.tsx" "src/app/(admin)/m/homework/page.tsx" "src/app/(admin)/m/homework/_components/MobileHomeworkClient.tsx" "src/app/(admin)/m/today/page.tsx"
git commit -m "refactor(actions): admin/m 모바일 화면 배럴 import 직접화"
```

---

## Task 9: 배럴 파일 삭제 + 최종 검증

**Files (Delete):**
- `src/app/(admin)/admin/actions.ts`

- [ ] **Step 1: 배럴 소비자가 0 개인지 확인**

Run:
```bash
grep -rl 'from "@/app/(admin)/admin/actions"' src --include="*.ts" --include="*.tsx" | wc -l
```
Expected: `0`
(0 이 아니면 남은 파일을 위 매핑 표대로 마저 고친 뒤 진행. 절대 0 이 아닌 상태로 삭제하지 않는다.)

- [ ] **Step 2: 배럴 파일 삭제**

Run:
```bash
git rm "src/app/(admin)/admin/actions.ts"
```

- [ ] **Step 3: type-check (배럴 없이도 통과해야 함)**

Run: `pnpm type-check`
Expected: exit 0

- [ ] **Step 4: 프로덕션 빌드로 최종 검증**

Run: `pnpm build`
Expected: 빌드 성공(에러 0). 서버 액션 import 경로가 모두 유효한지 빌드 레벨에서 확인.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(actions): 사용처 없어진 admin/actions 배럴 파일 제거"
```

---

## Self-Review 체크리스트 (작성자 기준)

- **커버리지**: 44개 소비자 = Task1(6) + Task2(4) + Task3(5) + Task4(3) + Task5(7) + Task6(7) + Task7(7) + Task8(5) = 44. ✅ Task9 에서 배럴 삭제로 마무리.
- **함정 반영**:
  - `createSeriesLevel/updateSeriesLevel/deleteSeriesLevel` → `textbook-actions` (Task6 Step4 LevelDropdown). ✅
  - `SeriesLevelRow` → `series-actions` (Task6 Step4/5/6/7). ✅
  - `getUnitSchedule` → `@/lib/utils/homework-schedule` (Task4 Step2). ✅
- **타입 일관성**: 모든 심볼명은 SSOT 표에서 그대로 인용. value/type 같은 소스면 한 import 로 합침, 다른 소스면 분리.
- **외부 재export**: 배럴이 재export 하던 `@/lib/types`(DropoffExportRow/Data), `@/lib/utils/homework-schedule`(StudentDayUnits 등) 중 **소비자가 배럴 경유로 쓰던 것은 `getUnitSchedule` 하나뿐** → Task4 에서 처리. 나머지는 소비자가 없으므로 배럴 삭제 시 자연 소멸. ✅
- **문서 영향**: `ARCHITECTURE.md` / `admin/actions/AGENTS.md` 는 배럴 파일(`actions.ts`)을 직접 언급하지 않음(허브 폴더 `actions/` 만 기술). 따라서 문서 수정 불필요. (실행 중 배럴을 언급하는 문서를 발견하면 그때 한 줄 정리.)
- **Placeholder 스캔**: 모든 코드 스텝에 실제 import 문 명시. TODO/TBD 없음. ✅

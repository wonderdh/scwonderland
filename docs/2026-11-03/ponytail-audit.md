# ponytail-audit — src/ 전체 (2026-11-03)

범위: `src/` 전체. 제외: `archive/`, `src/lib/types/database.generated.ts`, `src/components/ui/`.
고치지 않음. 목록만. 줄 수 절감은 해당 블록을 실제로 읽고 센 추정치.

태그: `native` 플랫폼/설치된 라이브러리가 이미 하는 일 · `shrink` 같은 로직, 더 짧게 · `yagni` 공용이 있는데 다시 만든 것 · `delete` 안 쓰는 것

---

## 요약 (큰 것부터)

| # | 항목 | 절감 |
|---|---|---|
| 1 | yagni: 숙제 관리 PC판 ↔ 모바일판 검색·필터 패널 복붙 (`ClassHomeworkManageTab` ↔ `MobileHomeworkClient`) | −200 |
| 2 | shrink: `ClassesManager.tsx` 생성 폼 ↔ 수정 폼이 통째로 복붙 (845~ / 1135~) | −250 |
| 3 | native: 손그림 `<svg>` 70개 → lucide 아이콘 (아래 파일별 이름) | −280 |
| 4 | yagni: `QueryTabNav` 사용처 0곳인데 같은 탭 내비 3개 재구현 | −110 |
| 5 | yagni: `AddStudentForm` ↔ `AddTeacherForm` 복붙 | −100 |
| 6 | yagni: `AssignClassHomeworkModal` ↔ `EditClassHomeworkModal` 149줄 공통 | −100 |
| 7 | shrink: 필터 칩 className 17번 복붙 (4파일) → `cn()` 헬퍼 1개 | −68 |
| 8 | shrink: 삼항 3단+ 중첩 9곳 → 룩업 테이블 | −45 |
| 9 | yagni: 요일 칩 5곳 각자 구현 | −40 |
| 10 | 기타 (아래 상세) | −150 |

**net: 약 −1,300 lines, −0 deps possible.**

---

## 1. native — 손그림 `<svg>` → lucide-react

lucide-react 는 이미 15개 파일에서 쓰고 있음. 모든 svg 는 heroicons 복사본이라 1:1 대응 아이콘이 있음.
3줄짜리 svg 는 `<X className="size-4" />` 1줄로 (−2), 13줄짜리 prettier 포맷 svg 는 −12.

| 파일 (줄 수) | 줄 → lucide 이름 | 절감 |
|---|---|---|
| `src/app/(admin)/m/page.tsx` (131) | 12 `CalendarDays` · 22 `CircleCheck` · 32 `ClipboardList` · 43 `BookOpen` · 53 `Bus` · 63 `BadgeCheck` · 73 `Monitor` · 122 `ChevronRight` | −17 |
| `src/app/academy/student/_components/StudentNav.tsx` (80) | 11 `User` · 21 `FileText` · 31 `Megaphone` · 41 `SquarePen` · 51 `BookOpen` · 61 `CalendarDays` · 71 `Bus` | −14 |
| `src/app/academy/teacher/_components/TeacherNav.tsx` (150) | 7 `Users` · 12 `FileText` · 17 `BookOpen` · 22 `Megaphone` · 27 `Settings` · 33 `SquarePen` · 38 `CalendarDays` · 43 `CircleCheck` | −15 |
| `src/app/(admin)/admin/classes/_components/ClassesManager.tsx` (1409) | 55 `GripVertical` · 289 `CircleAlert` · 293 `CircleCheck` · 343 `Search` · 427 `Users` · 476 `User` · 1389 `X`(13줄) | −26 |
| `src/app/(admin)/admin/homework/_components/SeriesCard.tsx` (lucide 이미 import 중) | 44 `Ellipsis` · 93 `BookOpen`(13줄) · 145 `ChevronDown`(13줄) | −28 |
| `src/app/(admin)/admin/notices/_components/NoticesManager.tsx` (lucide 이미 import 중) | 282 `X`(13줄) | −12 |
| `src/components/homework/UnitProgressGrid.tsx` | 120 `BookOpen`(13줄) · 181 `Check`(9줄) | −20 |
| `src/components/feedback/Spinner.tsx` (47) | 22 svg 21줄 → `<Loader2 className="animate-spin" />` | −18 |
| `src/components/forms/FileUpload.tsx` | 84 `Upload`(13줄) · 122 `X` | −14 |
| `src/app/(admin)/m/homework/page.tsx` | 60 `ChevronLeft`(13줄) | −12 |
| `src/app/(admin)/m/today/page.tsx` | 25 `ChevronLeft`(13줄) | −12 |
| `src/app/(admin)/admin/students/_components/StudentTextbookTab.tsx` | 273 `BookOpen`(13줄) | −12 |
| `src/app/academy/student/homework/page.tsx` | 18 `BookOpen`(13줄) | −12 |
| `src/app/academy/student/_components/DashboardWidgets.tsx` | 159 `Users`(13줄) | −12 |
| `src/components/forms/FileList.tsx` | 24 `Image` · 31 `Volume2` · 37 `FileText` · 77 `Trash2` | −8 |
| `src/app/(admin)/admin/teachers/_components/TeacherClassesTab.tsx` | 126 `ChevronRight`(8줄) | −7 |
| `src/app/(admin)/admin/students/_components/StudentAttendanceTab.tsx` | 158 `ChevronLeft` · 164 `ChevronRight` · 296 `X` | −6 |
| `src/app/(admin)/m/attendance/_components/MobileAttendanceClient.tsx` | 64 · 99 · 202 모두 `ChevronLeft` | −6 |
| `src/app/academy/teacher/_components/TeacherReportClient.tsx` | 312 · 325 `Check` · 466 `Copy` | −6 |
| `src/app/(admin)/admin/bus/_components/BusExportButton.tsx` (58) | 42 스피너 → 공용 `Spinner size="sm" className="text-white"` · 50 `Download` | −5 |
| `src/app/(admin)/m/reading/page.tsx` | 11 `ChevronLeft` · 39 `ChevronRight` | −4 |
| `src/app/(admin)/m/bus-change/page.tsx` 23 · `m/bus-check/page.tsx` 18 · `m/reading/[studentId]/page.tsx` 29 · `(monitor)/bus-monitor/page.tsx` 25 | 전부 `ChevronLeft` | −2 ×4 |
| `src/app/academy/teacher/page.tsx` 14 `ArrowRight` · `academy/_components/PortalNav.tsx` 39 `User` · `bus/_components/BusStaffMonitor.tsx` 559 `RefreshCw` · `components/forms/AudioRecorder.tsx` 141 `Mic` · `components/navigation/LogoutButton.tsx` 65 `LogOut` | | −2 ×5 |
| `src/app/(admin)/admin/_components/AdminListSidebar.tsx` 98 | lucide `Trash2` 의 path 를 그대로 복사해 둔 1줄 svg → `<Trash2 size={16} />` | 0 (native 만) |
| `src/app/(admin)/admin/afterschool/_components/AfterschoolPageClient.tsx` 44 | `Printer` (1줄) | 0 |

덤 (shrink): `m/` 아래 7개 페이지의 "← 뒤로" 헤더가 svg 포함 8줄씩 똑같음 (`bus-change`, `bus-check`, `homework`, `reading`, `reading/[studentId]`, `today`, `attendance` ×3). `MobileBackHeader` 1개로 빼면 −40.

소계 약 **−280**.

---

## 2. shrink — 삼항 3단 이상 중첩 → 룩업 테이블

### `src/app/bus/_components/BusStaffMonitor.tsx` (719) — 131 (7단), 147 (6단), 157 (3단) · 절감 −10
세 체인이 모두 같은 "행 상태" 를 판정함. 상태를 한 번 정하고 표에서 꺼낸다.
```ts
type RowState = "board" | "unboard" | "check" | "uncheck" | "checked" | "boarded" | "changed" | "idle";
function rowState(): RowState {
  if (pendingAction) return pendingAction;
  if (isChecked) return "checked";
  if (isBoarded) return "boarded";
  if (student.is_changed) return "changed";
  return "idle";
}
const CIRCLE: Record<RowState, string> = {
  board: "bg-blue-500 text-white scale-110",  unboard: "bg-slate-200 text-slate-500 scale-110",
  check: "bg-green-500 text-white scale-110", uncheck: "bg-yellow-400 text-white scale-110",
  checked: "bg-green-100 text-green-600",     boarded: "bg-blue-100 text-blue-600",
  changed: "bg-amber-100 text-amber-600",     idle: "bg-slate-100 text-slate-400",
};
const SYMBOL: Record<RowState, string> = { board: "●", unboard: "○", check: "✓", uncheck: "↩", checked: "✓", boarded: "●", changed: "↗", idle: "○" };
// 사용: const s = rowState(); className={`… ${CIRCLE[s]}`}  {SYMBOL[s]}
```

### `src/components/bus/MonitorBusCard.tsx` (406) — 228 과 293 (같은 rowBg 체인 2번), 307 (이모지 4단) · 절감 −12
```ts
const studentState = (s: Student) => s.checked_at ? "checked" : s.is_changed ? "changed" : s.boarded_at ? "boarded" : "idle";
// ↑ 이 한 줄만 남기고
const ROW_BG = { checked: "bg-green-50/40", changed: "bg-amber-50", boarded: "bg-blue-50/30", idle: "" } as const;
const ROW_BG_MONITOR = { checked: "bg-green-50/50", changed: "bg-amber-50", boarded: "bg-blue-50/40", idle: "" } as const;
const EMOJI = { checked: "✅", boarded: "🚌", absent: "🔴", idle: "⬜" } as const;
```
`BusDashboard.tsx` 527 의 rowBg 체인(4단)도 같은 상태 판정 → `studentState` 를 `src/lib/bus/` 로 올리면 세 파일이 공유.

### `src/app/(admin)/admin/bus/_components/BusDashboard.tsx` (642) — 524 (isChecked 2단), 527 (rowBg 4단) · 절감 −6
```ts
const ROW_BG = { pending: "bg-amber-50 ring-1 ring-amber-300 ring-inset", checked: "bg-green-50/60", changed: "bg-amber-50/60", boarded: "bg-blue-50/50", idle: "hover:bg-slate-50" };
const rowBg = ROW_BG[hasPending ? "pending" : studentState(student)];
```

### `src/app/(admin)/admin/_components/AdminListSidebar.tsx` (153) — 116 (badgeInfo 4단) · 절감 −4
```ts
const BADGE = {
  students: { 유치부: { label: "유치부", className: "bg-amber-100 text-amber-800" }, 오후반: { label: "오후반", className: "bg-sky-100 text-sky-800" } },
  teachers: { native: { label: "원어민", className: "bg-blue-100 text-blue-800" }, korean: { label: "한국인", className: "bg-emerald-100 text-emerald-800" } },
} as const;
const badgeInfo = variant === "students"
  ? BADGE.students[user.group_type as keyof typeof BADGE.students] ?? null
  : BADGE.teachers[user.teacher_type === "native" ? "native" : "korean"];
```

### `src/app/(admin)/admin/classes/_components/ClassScheduleManager.tsx` (676) — 562 (savedBg 3단 중첩), 573 (pendingBg 3단) · 절감 −6
```ts
const CELL_BG = {
  native: { saved: "bg-blue-50 border border-blue-200",       pending: "bg-blue-100" },
  korean: { saved: "bg-emerald-50 border border-emerald-200", pending: "bg-emerald-100" },
  none:   { saved: "bg-slate-50 border border-slate-200",     pending: "bg-amber-50" },
} as const;
const savedBg = existing ? CELL_BG[existing.teacherId ? existing.teacherType : "none"].saved : null;
const pendingBg = CELL_BG[pendingTeacherType ?? "none"].pending;
```

### `src/app/academy/_components/AcademyShell.tsx` (93) — 19 (homeHref 3단) · 절감 −5
```ts
const HOME_HREF = { admin: "/admin", teacher: "/academy/teacher", student: "/academy/student" } as const;
const homeHref = HOME_HREF[role as keyof typeof HOME_HREF] ?? "/dashboard";
```

### `src/app/(monitor)/lunch-monitor/LunchMonitorClient.tsx` (241) — 198 (isLeader × isFirst 2×2) · 절감 −3
```ts
const AVATAR = { leader: ["bg-amber-400 text-slate-900", "bg-white text-blue-700"], member: ["bg-slate-700 text-slate-300", "bg-blue-900 text-blue-200"] } as const;
AVATAR[student.isLeader ? "leader" : "member"][Number(isFirst)]
```

### `src/components/homework/HomeworkBoard.tsx` (185) — 99 (emptyHint 3단) · 절감 −2
```ts
const emptyHint =
  [[!board.seriesId, "시리즈를 선택하세요."], [board.isLoading, "불러오는 중…"], [board.filteredStudents.length === 0, "해당 시리즈·레벨에 학생이 없습니다."]]
    .find(([cond]) => cond)?.[1] ?? null;
```
솔직히 원문도 읽힘. 우선순위 최하.

### `src/app/(admin)/admin/actions/bus/manifest-actions.ts` (453) — 301 (newBusId 3단, 안에 2단 더) · 절감 0
값이 아니라 분기 로직이라 표로는 안 바뀜. `if … return` 4줄짜리 함수 `pickNewBusId(stopId, slotId, requested)` 로 풀면 읽기만 좋아짐.

소계 약 **−45**.

---

## 3. shrink — 같은 className 2번 이상 복붙 → `cn()`

`cn()` 은 `src/lib/utils/cn.ts` 에 있고 62개 파일이 이미 씀.

### 필터 칩 — 4개 파일 17번 복붙, 5줄씩 완전히 동일 · 절감 −68
`ClassesOverview.tsx` 157·175·(+1) / `ClassHomeworkManageTab.tsx` 461·486·(+4) / `MobileHomeworkClient.tsx` 375·399·(+4) / `components/homework/HomeworkBoard.tsx` 43·64
```ts
// src/lib/ui/chip.ts
export const filterChip = (active: boolean) =>
  cn("px-3 py-1 rounded-full text-xs font-medium transition-colors border",
     active ? "bg-primary text-primary-foreground border-primary shadow-sm"
            : "bg-white text-slate-700 border-slate-200 hover:border-primary/50 hover:text-primary");
// 사용: className={filterChip(groupFilter === "all")}
```
같은 파일들의 요일 토글 버튼(`ClassHomeworkManageTab` 568 · `MobileHomeworkClient` 482 · `ClassesOverview` 246) 도 문자열이 완전히 같음 → `dayToggle(on)` −15.

### `src/app/(admin)/admin/classes/_components/ClassesManager.tsx` (1409) · 절감 −250
"선택됨/아님" 3종이 각각 2번씩 (845↔1135 요일, 879↔1169 색상, 909↔1199 교사). 그런데 이건 className 복붙이 아니라 **생성 모달 폼 전체가 수정 모달에 통째로 복사된 것** (label ×8, input ×7, 에러 박스 ×3, 버튼 ×3 까지 전부 2벌). 진짜 수정은 `ClassForm` 컴포넌트 하나로 빼서 두 모달이 같이 쓰는 것. cn 만 적용하면:
```ts
const dayChip = (on: boolean, locked: boolean) =>
  cn("flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm cursor-pointer",
     on ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600",
     locked && "opacity-60 cursor-not-allowed");
const swatch = (on: boolean) => cn("w-6 h-6 rounded-full border-2 transition", on ? "border-slate-600 scale-110" : "border-transparent");
const teacherRow = (on: boolean) => cn("flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-colors", on ? "bg-primary/10" : "hover:bg-muted/50");
```

### `src/app/(admin)/m/attendance/_components/MobileAttendanceClient.tsx` (269) · 절감 −12
세그먼트 버튼 "켜짐/꺼짐" 이 77·209 에는 켜짐 상태로 박혀 있고 228 에만 조건부.
```ts
const seg = (on: boolean) => cn("text-xs font-medium px-3 py-1 rounded-md", on ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground");
```
sticky 헤더 `sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3` ×3 도 한 변수로.

### `src/app/(admin)/admin/timetable/_components/GroupTimetableGrid.tsx` (751) · 절감 −8
셀 버튼이 두 렌더 경로에 똑같이 (545↔726 선택됨, 558↔739 아님).
```ts
const cell = (selected: boolean, day: Day) =>
  cn("w-full text-left px-2 py-1 text-sm border-b last:border-b-0 transition-colors",
     selected ? "font-medium ring-2 ring-amber-400 ring-inset" : `cursor-pointer ${DAY_COLORS[day].bg} hover:brightness-95`);
```

### `src/app/(admin)/admin/bus/page.tsx` (143) · 절감 −20
`<details>` 블록 3개가 summary·제목·화살표 className 까지 ×3 동일 → `SECTIONS.map(...)`.

### 상수로만 빼도 되는 것 (줄 수 이득 거의 0, 통일 목적)
| 파일 | 반복 |
|---|---|
| `AssignClassHomeworkModal.tsx` ×7 · `EditClassHomeworkModal.tsx` ×6 · `ClosedDaysClient.tsx` ×3 · `TeacherTextbooksClient.tsx` ×3 · `StudentTextbookTab.tsx` ×2 | label `mb-1.5 block text-sm font-medium text-slate-700` → 4절의 `FormGroup` 이 정답 |
| `AdminBusChangeDnD.tsx` ×7 · `BusChangeRequestsPanel.tsx` ×4 · `StudentBusTab.tsx` ×5 | label `text-base font-semibold text-slate-700 block mb-2` 류 |
| `ReportTranslateManager.tsx` th ×6/×3 · `reports/page.tsx` th ×4 · `TrashView.tsx` th ×2 | 테이블 헤더 셀 |
| `ReservationDashboard.tsx` ×4 · `NoticesManager.tsx` ×2 | input `w-full rounded-lg border border-slate-200 px-3 py-2 text-base` |
| `ClassHomeworkManageTab.tsx` ×7 · `MobileHomeworkClient.tsx` ×7 · `ClassesOverview.tsx` ×4 | 필터 라벨 `shrink-0 text-xs font-semibold text-slate-500 w-16` (1번 항목과 함께 사라짐) |

소계 약 **−130** (+ ClassesManager 폼 추출 −250 별도).

---

## 4. yagni — 공용 컴포넌트가 있는데 라우트에서 다시 만든 것

### A. 공용으로 바꿀 수 있는 것

**탭 내비 → `src/components/navigation/QueryTabNav.tsx` (현재 import 0곳 = delete 후보였던 것이 사실은 정답)**
| 라우트 파일 | 차이 | 절감 |
|---|---|---|
| `admin/students/_components/StudentTabNav.tsx` (56) | 아이콘 prop 없음, 활성색 주황/`h-12`. 라우트 쪽은 `useEffect`+eslint-disable 로 낙관적 활성 처리, 공용은 계산값 — 공용이 더 나음 | −40 |
| `admin/teachers/_components/TeacherTabNav.tsx` (54) | 위와 TABS·경로만 다름 | −40 |
| `admin/bus/_components/BusTabNav.tsx` (45) 유사(확인 필요) | 링크가 `?tab=` 형태라 공용의 `&tab=` 규칙과 안 맞음 | −30 |

**모달 → `src/components/overlays/Modal.tsx`**
- `admin/homework/_components/SeriesEditorModal.tsx` (264) 118–125 직접 만든 `fixed inset-0`. `max-w-lg` 가 Modal 크기 옵션에 없음. 지금은 Esc·포커스 트랩·스크롤 잠금이 다 빠져 있음. 절감 −3 (이득은 줄 수가 아니라 동작).

**빈 상태 → `src/components/feedback/EmptyState.tsx`** · 합계 −15
점선 박스 빈 상태를 직접 그린 곳 13개: `ClassesOverview` 134·275 / `ClassScheduleManager` 404·516 / `GroupTimetableGrid` 285·293 / `TeacherTimetableTab` 245 / `ClassHomeworkManageTab` 701 / `PublishersDialog` 280 / `SeriesCardsManager` 165 / `ReservationDashboard` 449 / `ClosedDaysClient` 137 / `TodayPageClient` 215 / `TeacherReportClient` 222·359.
차이: 공용 title 은 `text-base font-medium text-slate-700` 고정, 라우트 쪽은 전부 `text-sm text-muted-foreground`. 겉모습이 조금 바뀜.
`<p className="… text-center py-N">…없습니다</p>` 한 줄짜리 13곳은 절감 0, 통일 목적만.

**스피너 → `src/components/feedback/Spinner.tsx`**
- `BusExportButton.tsx` 42 인라인 svg 스피너 → `Spinner size="sm" className="text-white"` −3
- `MobileAttendanceClient.tsx` 127 border 스피너 → `Spinner` −1
- "불러오는 중…" `animate-pulse` 텍스트 4곳 (`BusOverviewPanel` 133·149, `BusStudentAssignmentManager` 453·595) → `LoadingState`. 절감 0.

**폼 라벨 → `src/components/forms/FormGroup.tsx`**
- `AssignClassHomeworkModal.tsx` (311) label 7개 + 에러 `<p>` 직접 마크업, FormGroup import 없음 → −10~15
- 유사(확인 필요): `EditClassHomeworkModal` 6개 · `ClassesManager` 14개 · `ClosedDaysClient` 3개 · `TeacherTextbooksClient` 3개 · `StudentTextbookTab` 2개

**페이지 헤더 → `src/components/navigation/PageHeader.tsx`**
- `AfterschoolPageClient.tsx` 36–38 h1 → −2
- 유사(확인 필요): `TodayPageClient.tsx` 84–91. description 에 `<b>` JSX 가 있는데 PageHeader 는 string 만 받음 → −5

**확인창 → `src/components/overlays/ConfirmDialog.tsx`**
- `window.confirm` 이 남은 4곳: `LevelDropdown.tsx` 81 · `ReportCardReplyForm.tsx` 43·84 · `TeacherReportClient.tsx` 180. 나머지 22곳은 이미 ConfirmDialog. 바꾸면 줄은 +8~10 늘어남. UX 통일 목적.

**진행 바 → `src/components/bus/MonitorBusCard.tsx` 의 `ProgressBar variant="admin"`**
- 유사(확인 필요): `BusStaffMonitor.tsx` 266–291 `StaffBusCard` 의 탑승/하차 바 2개. 공용은 한 줄에 두 색 겹침, 라우트는 라벨 붙은 바 2개 → −15

### B. 라우트 `_components` 끼리 복붙 (공용엔 없음)

| 항목 | 파일 | 공통 | 절감 |
|---|---|---|---|
| 숙제 관리 PC ↔ 모바일 | `admin/homework/_components/ClassHomeworkManageTab.tsx` (828) ↔ `m/homework/_components/MobileHomeworkClient.tsx` (614) | `GROUP_FILTERS`·`defaultPeriodId`·`buildSearchHaystack` 동일, 검색+필터 패널 178줄 중 다른 줄 21줄 | **−200** |
| 학생/교사 추가 폼 | `AddStudentForm.tsx` (119) ↔ `AddTeacherForm.tsx` (126) | 서버 액션·문구·교사 쪽 "자동생성" 버튼만 다름 | −100 |
| 숙제 부여/수정 모달 (확인 필요) | `AssignClassHomeworkModal.tsx` (311) ↔ `EditClassHomeworkModal.tsx` (315) | 149줄 공통, WEEKDAYS 상수 동일. `EditDaysModal`(`TeacherTextbooksClient.tsx`) 도 75줄 공통, 같은 액션 호출 | −100 |
| 요일 칩 | `ClassHomeworkManageTab` `DayChips` 63–85 · `StudentTextbookTab` `DayBadges` 29–49 · 인라인 `AssignClassHomeworkModal` 135 · `EditClassHomeworkModal` 150 · `TeacherTextbooksClient` 159 | 색(주황/하늘)·크기만 다름 → `DayChips {days, tone, size}` | −40 |
| 시간표 교사 색상 | `ClassScheduleManager.tsx` 23–45 ↔ `GroupTimetableGrid.tsx` 24–47 | `TEACHER_COLOR_PALETTE`·`buildTeacherColorMap` 완전 동일 → `lib/` | −23 |
| 저장 중 오버레이 | `ReservationDashboard.tsx` 659 ↔ `WeeklySentencesManager.tsx` 463 | `fixed inset-0 bg-white/60` + `LoadingState` 동일 | −6 |
| 학생/교사 정보 카드 (확인 필요) | `StudentSelectedView.tsx` (337) ↔ `TeacherInfoCard.tsx` (302) | 148줄 공통: 편집/삭제 state, 아이디 행, 삭제 ConfirmDialog | −80 |
| 호차 배정 화면 (확인 필요) | `BusStopAssignmentManager.tsx` (691) ↔ `BusStudentAssignmentManager.tsx` (711) | 116줄 공통: 호차×요일 테이블, 드래그 state | −60 |
| 탑승 체크 화면 (확인 필요) | `admin/bus/_components/BusDashboard.tsx` (642) ↔ `app/bus/_components/BusStaffMonitor.tsx` (719) | 107줄 공통: `PendingChange` 타입, 낙관적 반영 switch. 정류장 그룹 기준은 서로 달라 통합 대상 아닐 수 있음 | −50 |
| 출결 PC ↔ 모바일 (확인 필요) | `MobileAttendanceClient.tsx` (269) ↔ `AdminAttendanceClient.tsx` (256) | 98줄 공통: 상태 버튼 렌더, `getMergedStatus`, 반 목록 | −50 |
| 그룹 스타일 맵 (확인 필요) | `ClassesOverview` 19 · `TeacherClassesTab` 12 · `ClassScheduleManager` 48 | 키·아이콘 같고 색만 다름 | −10 |

제외: `AdminMobileHeader` 의 `fixed inset-0` (드로어), `SeriesCard` 의 드롭다운 (비교할 공용 메뉴 없음), `DashboardWidgets` 스켈레톤 (이미 `SkeletonBone` 사용).

소계 약 **−600** (확인 필요 항목 포함 시 −850).

---

## 진행 상태 (2026-11-03)

| 순서 | 커밋 | 결과 |
|---|---|---|
| 1 svg → lucide | `a6a0c43` | 33파일, −253줄 |
| 2 필터 칩·요일 칩 헬퍼 | `553a41d` | 8파일, −150줄 |
| 3 QueryTabNav 채택 | `2ca2dd0` | 4파일, −81줄 |
| 4 버스 행 상태 룩업 | `832a70d` | 2파일, −5줄 (3체인 → 판정 1줄 + 표). 화면별 우선순위가 달라 공용 함수로는 안 합침 |
| 5 큰 복붙 통합 | 보류 | 동작 회귀 위험. **해당 화면을 고칠 일이 생길 때 같이 합친다** (사용자 결정) |

## 권장 순서

1. **1번 svg → lucide**: 기계적이고 안전. 파일 32개, −280. 한 커밋.
2. **3번 필터 칩 `cn()` 헬퍼 + 4-B 요일 칩**: 작은 헬퍼 2개로 −120.
3. **4-A `QueryTabNav` 채택**: 안 쓰는 공용 하나가 재구현 3개를 대체. −110.
4. **2번 버스 행 상태 룩업**: `studentState()` 를 `lib/bus/` 에 1개 두고 3파일이 공유. −30.
5. **큰 복붙 통합** (숙제 PC↔모바일, ClassesManager 폼, Add*Form, Assign↔Edit 모달): 각각 −100~−250 이지만 동작 회귀 위험이 있어 화면별로 따로, 테스트하며.

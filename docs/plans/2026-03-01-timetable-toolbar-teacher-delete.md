# Timetable Toolbar + Teacher Delete Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** (1) 교사 삭제 시 반 담임·수업 배정 자동 해제 + 커스텀 경고 모달, (2) 시간표 그리드를 툴바+체크박스 방식으로 재설계하고 교재 배정 지원 추가.

**Architecture:** 교사 삭제 로직은 `deleteUserById` Server Action에 배정 cleanup을 통합하고, 별도 `getTeacherAssignmentCounts` action으로 사전 경고 정보를 제공한다. 시간표는 `GroupTimetableGrid`를 완전 재설계해 팝업 대신 툴바+pendingChanges Map 패턴으로 교체하며, DB에는 `class_schedules.textbook_id` 컬럼을 추가한다.

**Tech Stack:** Next.js 15 App Router, React 19, Supabase (Admin Client, service role), TypeScript, Tailwind CSS v4, shadcn/ui

---

## Task 1: DB 마이그레이션 — class_schedules에 textbook_id 추가

**Files:**
- Modify: Supabase DB (via MCP execute_sql)
- Modify: `lib/types/database.ts`

**Step 1: DB에 컬럼 추가**

Supabase MCP `execute_sql`로 실행:
```sql
ALTER TABLE class_schedules
ADD COLUMN IF NOT EXISTS textbook_id UUID REFERENCES textbooks(id) ON DELETE SET NULL;
```

**Step 2: 결과 확인**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'class_schedules' AND column_name = 'textbook_id';
```
Expected: `textbook_id | uuid | YES` 행이 반환됨.

**Step 3: TypeScript 타입 업데이트**

`lib/types/database.ts`에서 `ClassScheduleWithDetails` 타입에 `textbook_id` 추가:
```ts
export type ClassScheduleWithDetails = {
  id: string;
  class_id: string;
  academy_period_id: string;
  day_of_week: number;
  teacher_profile_id: string | null;
  label: string | null;
  textbook_id: string | null;   // 추가
  period_name: string;
  period_start_time: string;
  period_end_time: string;
  teacher_name: string | null;
  teacher_type: "korean" | "native";
};
```

**Step 4: 빌드 확인**
```bash
npm run build
```
Expected: 빌드 성공 (타입 에러 없음)

**Step 5: Commit**
```bash
git add lib/types/database.ts
git commit -m "feat: add textbook_id column to class_schedules"
```

---

## Task 2: schedule-actions.ts 업데이트 — textbooks 조회 + textbook_id 저장

**Files:**
- Modify: `app/(admin)/admin/actions/schedule-actions.ts`

**Step 1: `GroupTimetableData` 타입에 textbooks 추가**

파일 상단 `GroupTimetableData` 타입에 추가:
```ts
export type GroupTimetableData = {
  periods: { id: string; name: string; start_time: string; end_time: string }[];
  classes: { id: string; name: string }[];
  cells: Record<string, {
    scheduleId: string;
    label: string | null;
    teacherId: string | null;
    teacherName: string | null;
    teacherType: "korean" | "native";
    textbookId: string | null;   // 추가
  }>;
  teachers: { id: string; name: string; teacher_type: "korean" | "native" }[];
  textbooks: { id: string; title: string; series: string | null }[];  // 추가
};
```

**Step 2: `getGroupTimetableGrid`에서 textbooks 조회 추가**

기존 "5. 전체 교사 목록" 조회 바로 아래에 추가:
```ts
// 6. 전체 교재 목록 (배정용)
const { data: allTextbooks } = await supabase
  .from("textbooks")
  .select("id, title, series")
  .eq("is_active", true)
  .order("title");
```

cells 맵 구성 시 `textbookId` 추가:
```ts
cells[`${s.class_id}_${s.academy_period_id}_${s.day_of_week}`] = {
  scheduleId: s.id,
  label: s.label ?? null,
  teacherId: s.teacher_profile_id ?? null,
  teacherName: teacher?.name ?? null,
  teacherType: (teacher?.teacher_type ?? "korean") as "korean" | "native",
  textbookId: s.textbook_id ?? null,   // 추가
};
```

return 문에 textbooks 추가:
```ts
return {
  periods,
  classes,
  cells,
  teachers: (allTeachers ?? []).map((t) => ({
    id: t.profile_id,
    name: t.name,
    teacher_type: t.teacher_type as "korean" | "native",
  })),
  textbooks: (allTextbooks ?? []).map((tb) => ({
    id: tb.id,
    title: tb.title,
    series: tb.series ?? null,
  })),
};
```

**Step 3: `addSingleClassSchedule`에 textbookId 파라미터 추가**

```ts
export async function addSingleClassSchedule(
  classId: string,
  academyPeriodId: string,
  dayOfWeek: number,
  teacherProfileId: string | null,
  label: string | null,
  textbookId: string | null = null,   // 추가
): Promise<{ error?: string }> {
  // ...
  const { error } = await supabase.from("class_schedules").upsert(
    {
      class_id: classId,
      academy_period_id: academyPeriodId,
      day_of_week: dayOfWeek,
      teacher_profile_id: teacherProfileId || null,
      label: label || null,
      textbook_id: textbookId || null,   // 추가
    },
    { onConflict: "class_id,academy_period_id,day_of_week" },
  );
  // ...
}
```

**Step 4: 빌드 확인**
```bash
npm run build
```

**Step 5: Commit**
```bash
git add app/(admin)/admin/actions/schedule-actions.ts
git commit -m "feat: add textbook support to timetable grid data and schedule upsert"
```

---

## Task 3: user-actions.ts — 교사 삭제 시 배정 cleanup + 카운트 조회 action 추가

**Files:**
- Modify: `app/(admin)/admin/actions/user-actions.ts`
- Modify: `app/(admin)/admin/actions.ts`

**Step 1: `getTeacherAssignmentCounts` action 추가**

`user-actions.ts` 파일에 `deleteUserById` 위에 추가:
```ts
/** 삭제 전 경고용: 교사의 반 담임 + 수업 배정 건수 조회 */
export async function getTeacherAssignmentCounts(
  userId: string
): Promise<{ classCount: number; scheduleCount: number }> {
  const supabase = createAdminClient();

  const [{ count: classCount }, { count: scheduleCount }] = await Promise.all([
    supabase
      .from("class_teachers")
      .select("*", { count: "exact", head: true })
      .eq("teacher_profile_id", userId),
    supabase
      .from("class_schedules")
      .select("*", { count: "exact", head: true })
      .eq("teacher_profile_id", userId),
  ]);

  return {
    classCount: classCount ?? 0,
    scheduleCount: scheduleCount ?? 0,
  };
}
```

**Step 2: `deleteUserById`에 배정 cleanup 로직 추가**

`profiles.deleted_at` 업데이트 코드 **앞에** 추가:
```ts
// 1. 반 담임 배정 삭제
const { error: classTeacherError } = await supabase
  .from("class_teachers")
  .delete()
  .eq("teacher_profile_id", id);
if (classTeacherError) {
  console.error("[deleteUserById:class_teachers]", classTeacherError.message, { id });
}

// 2. 수업 배정 삭제
const { error: scheduleError } = await supabase
  .from("class_schedules")
  .delete()
  .eq("teacher_profile_id", id);
if (scheduleError) {
  console.error("[deleteUserById:class_schedules]", scheduleError.message, { id });
}
```

**Step 3: `actions.ts` barrel에 새 action export 추가**

`app/(admin)/admin/actions.ts`에서 `getTeacherAssignmentCounts` re-export 추가:
```ts
export { getTeacherAssignmentCounts } from "./actions/user-actions";
```
(기존 user-actions export 줄 옆에 추가)

**Step 4: 빌드 확인**
```bash
npm run build
```

**Step 5: Commit**
```bash
git add app/(admin)/admin/actions/user-actions.ts app/(admin)/admin/actions.ts
git commit -m "feat: cleanup teacher assignments on soft delete, add assignment count query"
```

---

## Task 4: TeacherInfoCard — 커스텀 삭제 확인 모달

**Files:**
- Modify: `app/(admin)/admin/teachers/components/TeacherInfoCard.tsx`

**현재 코드 구조 파악:**
- `handleDelete`에서 `confirm()` 사용 중
- `saveMessage` state 이미 있음
- 삭제 후 `setSaveMessage({ type: "success", text: "휴지통으로 이동되었습니다." })` + 1.5s 후 navigate

**Step 1: import에 `getTeacherAssignmentCounts` 추가**

파일 상단 import 수정:
```ts
import { resetUserPassword, getTeacherAssignmentCounts } from "../../actions";
```

**Step 2: 모달 state 추가**

기존 state 선언부에 추가:
```ts
const [deleteModal, setDeleteModal] = useState<{
  classCount: number;
  scheduleCount: number;
} | null>(null);
const [deleteModalLoading, setDeleteModalLoading] = useState(false);
```

**Step 3: `handleDelete` 수정 — confirm() 제거, 모달 오픈으로 변경**

```ts
const handleDelete = async () => {
  setDeleteModalLoading(true);
  const counts = await getTeacherAssignmentCounts(user.id);
  setDeleteModalLoading(false);
  setDeleteModal(counts);
};

const handleDeleteConfirm = async () => {
  setDelPending(true);
  const form = new FormData();
  form.set("id", user.id);
  const result = await onDelete(form);
  setDelPending(false);
  setDeleteModal(null);
  if (result?.error) {
    setError(result.error);
    return;
  }
  setSaveMessage({ type: "success", text: "휴지통으로 이동되었습니다." });
  setTimeout(() => {
    router.push("/admin/teachers");
    router.refresh();
  }, 1500);
};
```

**Step 4: JSX에 삭제 버튼 + 모달 추가**

삭제 버튼의 `onClick`을 `handleDelete`로 유지하되, `disabled`에 `deleteModalLoading` 추가:
```tsx
<Button
  variant="outline"
  size="sm"
  className="text-destructive border-destructive/30 hover:bg-destructive/10"
  onClick={handleDelete}
  disabled={delPending || deleteModalLoading}
>
  {deleteModalLoading ? "확인 중…" : delPending ? "삭제 중…" : "삭제"}
</Button>
```

컴포넌트 return 맨 끝, `</div>` 닫기 전에 모달 추가:
```tsx
{/* 삭제 확인 모달 */}
{deleteModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
      <h3 className="text-base font-semibold text-foreground mb-2">교사 삭제</h3>
      <p className="text-sm text-muted-foreground mb-1">
        <span className="font-medium text-foreground">{user.name ?? user.first_name}</span> 선생님은 현재
      </p>
      <ul className="text-sm mb-4 space-y-1">
        {deleteModal.classCount > 0 && (
          <li className="text-amber-700">• 반 담임 <strong>{deleteModal.classCount}개</strong></li>
        )}
        {deleteModal.scheduleCount > 0 && (
          <li className="text-amber-700">• 수업 배정 <strong>{deleteModal.scheduleCount}건</strong></li>
        )}
        {deleteModal.classCount === 0 && deleteModal.scheduleCount === 0 && (
          <li className="text-muted-foreground">• 배정된 반/수업 없음</li>
        )}
      </ul>
      <p className="text-sm text-muted-foreground mb-4">
        삭제 시 모든 배정이 해제됩니다. 계속하시겠습니까?
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setDeleteModal(null)} disabled={delPending}>
          취소
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDeleteConfirm}
          disabled={delPending}
        >
          {delPending ? "삭제 중…" : "삭제"}
        </Button>
      </div>
    </div>
  </div>
)}
```

**Step 5: 빌드 확인**
```bash
npm run build
```

**Step 6: Commit**
```bash
git add app/(admin)/admin/teachers/components/TeacherInfoCard.tsx
git commit -m "feat: custom delete modal with assignment count warning for teacher"
```

---

## Task 5: StudentSelectedView — 동일한 커스텀 삭제 모달 적용

**Files:**
- Modify: `app/(admin)/admin/students/components/StudentSelectedView.tsx`

Task 4와 동일한 패턴. 단, 학생은 `class_teachers`/`class_schedules` 배정이 없으므로 `getTeacherAssignmentCounts` 대신 학생용 모달은 단순 확인만 함.

**Step 1: `handleDelete` 수정 — confirm() 제거**

```ts
const [deleteModal, setDeleteModal] = useState(false);

const handleDelete = () => {
  setDeleteModal(true);
};

const handleDeleteConfirm = async () => {
  setDelPending(true);
  const form = new FormData();
  form.set("id", user.id);
  const result = await onDelete(form);
  setDelPending(false);
  setDeleteModal(false);
  if (result?.error) {
    setError(result.error);
    return;
  }
  setSaveMessage({ type: "success", text: "휴지통으로 이동되었습니다." });
  setTimeout(() => {
    router.push("/admin/students");
    router.refresh();
  }, 1500);
};
```

**Step 2: JSX에 모달 추가**

```tsx
{deleteModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
      <h3 className="text-base font-semibold text-foreground mb-2">학생 삭제</h3>
      <p className="text-sm text-muted-foreground mb-4">
        <span className="font-medium text-foreground">
          {user.korean_name ?? user.first_name}
        </span> 학생을 휴지통으로 이동합니다. 계속하시겠습니까?
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setDeleteModal(false)} disabled={delPending}>
          취소
        </Button>
        <Button variant="destructive" size="sm" onClick={handleDeleteConfirm} disabled={delPending}>
          {delPending ? "삭제 중…" : "삭제"}
        </Button>
      </div>
    </div>
  </div>
)}
```

**Step 3: 빌드 확인**
```bash
npm run build
```

**Step 4: Commit**
```bash
git add app/(admin)/admin/students/components/StudentSelectedView.tsx
git commit -m "feat: custom delete confirmation modal for student"
```

---

## Task 6: GroupTimetableGrid 재설계 — 툴바 + 체크박스 + 일괄 저장

**Files:**
- Modify: `app/(admin)/admin/timetable/components/GroupTimetableGrid.tsx`

이 파일은 전체를 재작성한다. 기존 `AssignPopup` 컴포넌트 제거, `PeriodDayGrid` 수정.

**Step 1: pendingChanges 타입 및 툴바 state 정의**

파일 상단에 타입 추가:
```ts
type PendingCell = {
  teacherId: string | null;
  label: string | null;
  textbookId: string | null;
};
```

`GroupTimetableGrid` 함수 내 state:
```ts
// 툴바 선택 상태
const [toolTeacherId, setToolTeacherId] = useState<string>("");
const [toolLabel, setToolLabel] = useState<string>("");
const [toolTextbookId, setToolTextbookId] = useState<string>("");

// 저장 대기 변경사항: key = `${classId}_${periodId}_${day}`
const [pendingChanges, setPendingChanges] = useState<Map<string, PendingCell>>(new Map());
const [saving, setSaving] = useState(false);
```

**Step 2: 셀 클릭 핸들러 구현**

```ts
function handleCellToggle(classId: string, periodId: string, day: number) {
  const key = `${classId}_${periodId}_${day}`;
  setPendingChanges((prev) => {
    const next = new Map(prev);
    if (next.has(key)) {
      next.delete(key); // 체크 해제
    } else {
      next.set(key, {
        teacherId: toolTeacherId || null,
        label: toolLabel || null,
        textbookId: toolTextbookId || null,
      });
    }
    return next;
  });
}
```

**Step 3: 저장 핸들러 구현**

```ts
async function handleSave() {
  if (pendingChanges.size === 0) return;
  setSaving(true);
  setError("");

  for (const [key, pending] of pendingChanges) {
    const parts = key.split("_");
    // key format: classId_periodId_day (UUID에 _가 없음, 그냥 split로 안 됨)
    // key format 재정의: `${classId}|${periodId}|${day}` 사용
  }
  // ... (아래 Step 4에서 key format 확정 후 완성)
}
```

> **주의:** UUID에는 `-`가 있지만 `_`는 없으므로 `_`로 split 가능. 하지만 명시적으로 `|` 구분자를 쓰는 게 안전함.

**Step 4: key format을 `|` 구분자로 수정**

`handleCellToggle`에서:
```ts
const key = `${classId}|${periodId}|${day}`;
```

`handleSave`에서:
```ts
async function handleSave() {
  if (pendingChanges.size === 0) return;
  setSaving(true);
  setError("");

  let hasError = false;
  for (const [key, pending] of pendingChanges) {
    const [classId, periodId, dayStr] = key.split("|");
    const result = await addSingleClassSchedule(
      classId,
      periodId,
      parseInt(dayStr, 10),
      pending.teacherId,
      pending.label,
      pending.textbookId,
    );
    if (result.error) {
      setError(result.error);
      hasError = true;
      break;
    }
  }

  if (!hasError) {
    setPendingChanges(new Map());
    await refreshData();
    router.refresh();
  }
  setSaving(false);
}
```

**Step 5: 툴바 JSX 구현 (요일 가이드 대체)**

기존 `{/* 요일 색상 가이드 */}` 블록 전체를 아래로 교체:

```tsx
{/* 배정 툴바 */}
<div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-xl border">
  {/* 선생님 선택 */}
  <div className="flex items-center gap-1.5">
    <span className="text-xs text-muted-foreground font-medium shrink-0">선생님</span>
    <select
      value={toolTeacherId}
      onChange={(e) => setToolTeacherId(e.target.value)}
      className="text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
    >
      <option value="">없음</option>
      {data.teachers.filter((t) => t.teacher_type === "native").length > 0 && (
        <optgroup label="원어민">
          {data.teachers
            .filter((t) => t.teacher_type === "native")
            .map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
        </optgroup>
      )}
      {data.teachers.filter((t) => t.teacher_type === "korean").length > 0 && (
        <optgroup label="한국인">
          {data.teachers
            .filter((t) => t.teacher_type === "korean")
            .map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
        </optgroup>
      )}
    </select>
  </div>

  {/* 과목 선택 */}
  <div className="flex items-center gap-1.5">
    <span className="text-xs text-muted-foreground font-medium shrink-0">과목</span>
    <select
      value={toolLabel}
      onChange={(e) => setToolLabel(e.target.value)}
      className="text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
    >
      <option value="">없음</option>
      {LABEL_OPTIONS.map((l) => (
        <option key={l} value={l}>{l}</option>
      ))}
    </select>
  </div>

  {/* 교재 선택 */}
  <div className="flex items-center gap-1.5">
    <span className="text-xs text-muted-foreground font-medium shrink-0">교재</span>
    <select
      value={toolTextbookId}
      onChange={(e) => setToolTextbookId(e.target.value)}
      className="text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary max-w-40"
    >
      <option value="">없음</option>
      {data.textbooks.map((tb) => (
        <option key={tb.id} value={tb.id}>
          {tb.series ? `[${tb.series}] ` : ""}{tb.title}
        </option>
      ))}
    </select>
  </div>

  {/* 우측 버튼들 */}
  <div className="flex items-center gap-2 ml-auto">
    {pendingChanges.size > 0 && (
      <button
        type="button"
        onClick={() => setPendingChanges(new Map())}
        className="text-xs px-2.5 py-1.5 rounded-lg border text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        전체해제
      </button>
    )}
    <button
      type="button"
      onClick={handleSave}
      disabled={pendingChanges.size === 0 || saving}
      className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors font-medium"
    >
      {saving ? "저장 중…" : pendingChanges.size > 0 ? `저장 ${pendingChanges.size}건` : "저장"}
    </button>
  </div>
</div>
```

**Step 6: `PeriodDayGrid` 수정 — 체크박스 방식으로**

`PeriodDayGrid` props 변경:
```ts
function PeriodDayGrid({
  classId,
  periodId,
  mergedCells,
  pendingChanges,    // 추가
  onCellToggle,      // 기존 onCellClick, onFilledCellClick 대체
  onDeleteClick,
  loading,
}: {
  classId: string;
  periodId: string;
  mergedCells: (MergedCell | null)[];
  pendingChanges: Map<string, PendingCell>;   // 추가
  onCellToggle: (classId: string, periodId: string, day: number) => void;   // 추가
  onDeleteClick: (scheduleIds: string[]) => void;
  loading: boolean;
})
```

빈 셀 렌더링:
```tsx
// pending 있는 경우
const pendingKey = `${classId}|${periodId}|${day}`;
const pending = pendingChanges.get(pendingKey);

if (pending) {
  // 체크된 빈 셀: 녹색 배경 + 체크마크
  rows.push(
    <button
      key={day}
      type="button"
      onClick={() => onCellToggle(classId, periodId, day)}
      className={`w-full text-left px-2 py-1 text-[11px] border-b last:border-b-0 bg-emerald-100 text-emerald-700 font-medium`}
      style={{ height: "24px" }}
    >
      ✓ {/* 간단한 체크 표시 */}
    </button>
  );
} else {
  // 기존 빈 셀 버튼 (변경 없음)
  rows.push(
    <button
      key={day}
      type="button"
      onClick={() => onCellToggle(classId, periodId, day)}
      disabled={loading}
      className={`w-full text-left px-2 py-1 text-[11px] border-b last:border-b-0 transition-colors cursor-pointer ${DAY_COLORS[day].bg} hover:brightness-95`}
      style={{ height: "24px" }}
    >
      <span className={`${DAY_COLORS[day].text} opacity-40`}>{DAY_LABELS[day - 1]}</span>
    </button>
  );
}
```

배정된 셀 렌더링 (기존 `onFilledCellClick` 제거, `onCellToggle` 사용):
```tsx
// pending 있으면 노란 테두리
const pendingKey = `${classId}|${periodId}|${cell.startDay}`;
const pending = pendingChanges.get(pendingKey);
const borderClass = pending ? "ring-2 ring-amber-400 ring-inset" : "";

rows.push(
  <div
    key={cell.startDay}
    className={`relative group border-b last:border-b-0 cursor-pointer ${borderClass}`}
    style={{ height: `${height}px` }}
    onClick={() => onCellToggle(classId, periodId, cell.startDay)}
  >
    {/* 기존 내용 유지 */}
    ...
  </div>
);
```

**Step 7: `GroupTimetableGrid` JSX에서 `PeriodDayGrid` props 업데이트**

```tsx
<PeriodDayGrid
  classId={cls.id}
  periodId={period.id}
  mergedCells={mergedCells}
  pendingChanges={pendingChanges}   // 추가
  onCellToggle={handleCellToggle}   // 변경
  onDeleteClick={handleDeleteSchedule}
  loading={loading || saving}
/>
```

**Step 8: 기존 popup 관련 코드 제거**
- `popup` state 및 관련 handler 제거
- `AssignPopup` 컴포넌트 제거
- `handleCellClick`, `handleFilledCellClick` 제거

**Step 9: 빌드 확인**
```bash
npm run build
```

**Step 10: Commit**
```bash
git add app/(admin)/admin/timetable/components/GroupTimetableGrid.tsx
git commit -m "feat: redesign timetable grid with toolbar+checkbox pattern and textbook support"
```

---

## Task 7: 최종 통합 테스트 체크리스트

수동 테스트:
1. `/admin/teachers` → 교사 선택 → 삭제 버튼 → 배정 카운트 모달 확인
2. 모달에서 삭제 확인 → "휴지통으로 이동" 메시지 → 목록에서 사라짐
3. Supabase에서 해당 교사의 `class_teachers`, `class_schedules` 행이 삭제됐는지 확인
4. `/admin/timetable?tab=kindergarten` → 툴바 표시 확인
5. 툴바에서 선생님 + 과목 + 교재 선택 → 여러 셀 클릭 → 체크 표시 확인
6. "저장 N건" 버튼 클릭 → DB에 반영됐는지 확인
7. 기존 배정 셀 클릭 → 노란 테두리 + 저장 후 덮어쓰기 확인
8. 기존 hover × 삭제 버튼 여전히 작동하는지 확인
9. `npm run build` 최종 확인

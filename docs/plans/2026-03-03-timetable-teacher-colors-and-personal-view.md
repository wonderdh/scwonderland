# Timetable Teacher Colors & Personal View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** (1) Color-code cells per teacher in the admin timetable grid for readability; (2) Redesign the teacher personal timetable tab to use Mon–Fri columns instead of all class columns.

**Architecture:**
- Task 1 touches only `GroupTimetableGrid.tsx`: add a 12-color palette, build `teacherColorMap` from `data.teachers`, thread it into `PeriodDayGrid`, and render a legend.
- Task 2 rewrites the rendering logic inside `TeacherTimetableTab.tsx`: replace class-column table with a day-column table. Data is derived client-side from existing `GroupTimetableData` — no server changes needed.

**Tech Stack:** React 19, Tailwind CSS v4, Next.js App Router (client components only)

---

## Task 1 — Teacher color palette in `GroupTimetableGrid`

**Files:**
- Modify: `app/(admin)/admin/timetable/components/GroupTimetableGrid.tsx`

### Step 1 — Add palette constant (top of file, after existing `DAY_COLORS`)

Replace the existing type-based color logic with a per-teacher palette. Add after `DAY_COLORS`:

```tsx
const TEACHER_COLOR_PALETTE: { bg: string; text: string }[] = [
  { bg: "bg-blue-200",   text: "text-blue-800"   },
  { bg: "bg-emerald-200",text: "text-emerald-800" },
  { bg: "bg-violet-200", text: "text-violet-800"  },
  { bg: "bg-rose-200",   text: "text-rose-800"    },
  { bg: "bg-amber-200",  text: "text-amber-800"   },
  { bg: "bg-cyan-200",   text: "text-cyan-800"    },
  { bg: "bg-pink-200",   text: "text-pink-800"    },
  { bg: "bg-orange-200", text: "text-orange-800"  },
  { bg: "bg-teal-200",   text: "text-teal-800"    },
  { bg: "bg-indigo-200", text: "text-indigo-800"  },
  { bg: "bg-lime-200",   text: "text-lime-800"    },
  { bg: "bg-sky-200",    text: "text-sky-800"     },
];

function buildTeacherColorMap(
  teachers: { id: string; name: string }[],
): Map<string, { bg: string; text: string }> {
  const sorted = [...teachers].sort((a, b) => a.name.localeCompare(b.name));
  const map = new Map<string, { bg: string; text: string }>();
  sorted.forEach((t, i) => {
    map.set(t.id, TEACHER_COLOR_PALETTE[i % TEACHER_COLOR_PALETTE.length]);
  });
  return map;
}
```

### Step 2 — Build `teacherColorMap` inside `GroupTimetableGrid`

Inside the `GroupTimetableGrid` component, add this (after the existing `useMemo` for `mergedData`):

```tsx
const teacherColorMap = useMemo(
  () => buildTeacherColorMap(data.teachers),
  [data.teachers],
);
```

### Step 3 — Add legend below the toolbar

Inside the JSX, after the closing `</div>` of the toolbar and before the `{/* 시간표 그리드 */}` comment, add:

```tsx
{/* 교사 색상 범례 */}
{data.teachers.length > 0 && (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
    {[...data.teachers]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => {
        const color = teacherColorMap.get(t.id);
        return (
          <span key={t.id} className="inline-flex items-center gap-1.5 text-xs">
            <span
              className={`w-3 h-3 rounded-sm ${color?.bg ?? "bg-slate-200"}`}
            />
            <span className="text-muted-foreground">{t.name}</span>
          </span>
        );
      })}
  </div>
)}
```

### Step 4 — Thread `teacherColorMap` into `PeriodDayGrid`

**Update `PeriodDayGrid` props type** — add `teacherColorMap`:

```tsx
function PeriodDayGrid({
  classId,
  periodId,
  mergedCells,
  pendingChanges,
  onCellToggle,
  onDeleteClick,
  loading,
  teacherColorMap,          // ← add
}: {
  classId: string;
  periodId: string;
  mergedCells: (MergedCell | null)[];
  pendingChanges: Map<string, PendingCell>;
  onCellToggle: (classId: string, periodId: string, day: number) => void;
  onDeleteClick: (scheduleIds: string[]) => void;
  loading: boolean;
  teacherColorMap: Map<string, { bg: string; text: string }>;  // ← add
}) {
```

**Update every `<PeriodDayGrid>` call** in the `GroupTimetableGrid` JSX — add `teacherColorMap={teacherColorMap}`.

### Step 5 — Use per-teacher color in filled cell rendering inside `PeriodDayGrid`

Find this block inside `PeriodDayGrid` (the filled cell rendering):

```tsx
const bgClass = hasTeacher
  ? cell.teacherType === "native"
    ? "bg-blue-100/70 text-blue-700"
    : "bg-emerald-100/70 text-emerald-700"
  : "bg-slate-100/70 text-slate-600";
```

Replace with:

```tsx
const teacherColor = cell.teacherId ? teacherColorMap.get(cell.teacherId) : undefined;
const bgClass = hasTeacher && teacherColor
  ? `${teacherColor.bg} ${teacherColor.text}`
  : hasTeacher
    ? "bg-slate-200 text-slate-700"
    : "bg-slate-100/70 text-slate-500";
```

### Step 6 — Verify visually

Run `npm run dev`, open `/admin/timetable` with 오후반. Confirm:
- Each teacher's name appears in a distinct color
- Legend at top maps name → color chip
- Empty cells still show faint day-label tint
- Pending (emerald) and amber-ring states still work

### Step 7 — Lint check

```bash
npm run lint
```
Expected: no errors.

---

## Task 2 — Teacher personal timetable: day-column layout

**Files:**
- Modify: `app/(admin)/admin/teachers/components/TeacherTimetableTab.tsx`

### Step 1 — Remove `mergeConsecutiveDays`, `MergedCell`, `DAY_COLORS`, `ReadOnlyDayGrid`

These are all unused in the new design. Delete:
- The `MergedCell` type definition
- The `mergeConsecutiveDays` function
- The `DAY_COLORS` constant
- The `ReadOnlyDayGrid` function component

Also remove the `useMemo` that builds `mergedData` inside `TeacherTimetableTab`.

### Step 2 — Add helper to compute teacher's day schedule

Add this helper function (above the `TeacherTimetableTab` component):

```tsx
/**
 * For each period, returns a map of day → class name (or null) for the given teacher.
 */
function buildTeacherDaySchedule(
  data: GroupTimetableData,
  teacherProfileId: string,
): Map<string, Map<number, string>> {
  // Map<periodId, Map<dayOfWeek, className>>
  const result = new Map<string, Map<number, string>>();
  for (const period of data.periods) {
    const dayMap = new Map<number, string>();
    for (const cls of data.classes) {
      for (let day = 1; day <= 5; day++) {
        const key = `${cls.id}_${period.id}_${day}`;
        const cell = data.cells[key];
        if (cell?.teacherId === teacherProfileId) {
          dayMap.set(day, cls.name);
        }
      }
    }
    result.set(period.id, dayMap);
  }
  return result;
}
```

### Step 3 — Replace `mergedData` useMemo with `teacherSchedule`

Inside `TeacherTimetableTab`, replace the existing `useMemo` with:

```tsx
const teacherSchedule = useMemo(
  () => (data ? buildTeacherDaySchedule(data, teacherProfileId) : new Map()),
  [data, teacherProfileId],
);
```

### Step 4 — Rewrite the table JSX

Replace everything inside the `<div className="overflow-x-auto rounded-xl border shadow-sm">` block with:

```tsx
<div className="overflow-x-auto rounded-xl border shadow-sm">
  <table className="w-full text-sm border-collapse">
    <thead>
      <tr className="bg-muted/50 border-b">
        <th className="py-3 px-3 text-left text-xs font-medium text-muted-foreground w-28 border-r">
          교시
        </th>
        {DAY_LABELS.map((label) => (
          <th
            key={label}
            className="py-3 px-3 text-center text-xs font-medium text-muted-foreground border-r last:border-r-0 w-24"
          >
            {label}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {data.periods.map((period) => {
        const dayMap = teacherSchedule.get(period.id) ?? new Map<number, string>();
        return (
          <tr key={period.id} className="border-b last:border-b-0">
            <td className="py-2 px-3 border-r align-middle">
              <div className="font-medium text-foreground text-xs">{period.name}</div>
              <div className="text-[10px] text-muted-foreground">
                {period.start_time.slice(0, 5)}~{period.end_time.slice(0, 5)}
              </div>
            </td>
            {[1, 2, 3, 4, 5].map((day) => {
              const className = dayMap.get(day);
              return (
                <td
                  key={day}
                  className={`py-2 px-2 border-r last:border-r-0 text-center text-xs font-medium align-middle ${
                    className
                      ? "bg-primary/15 text-primary"
                      : "bg-slate-50 text-muted-foreground/30"
                  }`}
                >
                  {className ?? "—"}
                </td>
              );
            })}
          </tr>
        );
      })}
    </tbody>
  </table>
</div>
```

### Step 5 — Remove now-unused legend (or update it)

The old legend showed "내 수업 / 다른 교사". Since the new view only shows the teacher's own classes, simplify the legend or remove it entirely.

Remove the entire `{/* 범례 */}` block.

### Step 6 — Verify visually

Run `npm run dev`, open any teacher's detail page, click the 시간표 탭.
- Confirm table has 5 day columns (월화수목금)
- Confirm assigned classes appear in the correct day column with highlight
- Confirm empty cells show `—`
- Switch group tabs (유치부/오후반/방과후) and confirm each loads correctly

### Step 7 — Lint check

```bash
npm run lint
```
Expected: no errors.

### Step 8 — Build check

```bash
npm run build
```
Expected: no type errors, build succeeds.

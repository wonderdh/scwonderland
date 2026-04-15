"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { GroupTimetableData, CellEntry } from "@/lib/types";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  getGroupTimetableGrid,
  setClassScheduleSlot,
  deleteClassSchedule,
} from "../../actions";

const DAY_LABELS = ["월", "화", "수", "목", "금"];

const DAY_COLORS: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: "bg-red-50", text: "text-red-700", label: "월" },
  2: { bg: "bg-orange-50", text: "text-orange-700", label: "화" },
  3: { bg: "bg-yellow-50", text: "text-yellow-700", label: "수" },
  4: { bg: "bg-green-50", text: "text-green-700", label: "목" },
  5: { bg: "bg-blue-50", text: "text-blue-700", label: "금" },
};

// IMPORTANT: All strings must be complete Tailwind class names (no dynamic concat) for purging to work.
const TEACHER_COLOR_PALETTE: { bg: string; text: string }[] = [
  { bg: "bg-blue-200",    text: "text-blue-800"    },
  { bg: "bg-emerald-200", text: "text-emerald-800"  },
  { bg: "bg-violet-200",  text: "text-violet-800"   },
  { bg: "bg-rose-200",    text: "text-rose-800"     },
  { bg: "bg-amber-200",   text: "text-amber-800"    },
  { bg: "bg-cyan-200",    text: "text-cyan-800"     },
  { bg: "bg-pink-200",    text: "text-pink-800"     },
  { bg: "bg-orange-200",  text: "text-orange-800"   },
  { bg: "bg-teal-200",    text: "text-teal-800"     },
  { bg: "bg-indigo-200",  text: "text-indigo-800"   },
  { bg: "bg-lime-200",    text: "text-lime-800"     },
  { bg: "bg-sky-200",     text: "text-sky-800"      },
];

function buildTeacherColorMap(
  sortedTeachers: { id: string; name: string }[],
): Map<string, { bg: string; text: string }> {
  const map = new Map<string, { bg: string; text: string }>();
  sortedTeachers.forEach((t, i) => {
    map.set(t.id, TEACHER_COLOR_PALETTE[i % TEACHER_COLOR_PALETTE.length]);
  });
  return map;
}

type PendingCell = {
  teacherIds: (string | null)[];
  label: string | null;
  textbookId: string | null;
};

type MergedCell = {
  entries: CellEntry[];
  scheduleIds: string[];
  startDay: number;
  span: number;
};

function cellEntriesEqual(a: CellEntry[], b: CellEntry[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((ae, i) => ae.teacherName === b[i].teacherName && ae.label === b[i].label);
}

function mergeConsecutiveDays(
  classId: string,
  periodId: string,
  cells: GroupTimetableData["cells"],
): (MergedCell | null)[] {
  const result: (MergedCell | null)[] = [];
  let i = 1;
  while (i <= 5) {
    const key = `${classId}_${periodId}_${i}`;
    const entries = cells[key];
    if (!entries?.length) {
      result.push(null);
      i++;
      continue;
    }
    let span = 1;
    const scheduleIds = entries.map((e) => e.scheduleId);
    while (i + span <= 5) {
      const nextKey = `${classId}_${periodId}_${i + span}`;
      const nextEntries = cells[nextKey];
      if (nextEntries?.length && cellEntriesEqual(entries, nextEntries)) {
        nextEntries.forEach((e) => scheduleIds.push(e.scheduleId));
        span++;
      } else {
        break;
      }
    }
    result.push({ entries, scheduleIds, startDay: i, span });
    i += span;
  }
  return result;
}

export function GroupTimetableGrid({
  groupLabel,
  initialData,
}: {
  groupLabel: string;
  initialData: GroupTimetableData;
}) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Toolbar: 선생님 목록 (복수) + 공유 과목/교재
  const [toolTeacherIds, setToolTeacherIds] = useState<string[]>([""]);
  const [toolLabel, setToolLabel] = useState("");
  const [toolTextbookId, setToolTextbookId] = useState("");

  // Pending changes: key = `${classId}|${periodId}|${day}`
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingCell>>(new Map());
  // Pending deletes: scheduleId set
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  const [conflictKeys, setConflictKeys] = useState<string[]>([]);

  const refreshData = useCallback(async () => {
    const newData = await getGroupTimetableGrid(groupLabel);
    setData(newData);
  }, [groupLabel]);

  function addTeacherRow() {
    setToolTeacherIds((prev) => [...prev, ""]);
  }

  function removeTeacherRow(index: number) {
    setToolTeacherIds((prev) => prev.filter((_, i) => i !== index));
  }

  function updateTeacherId(index: number, value: string) {
    setToolTeacherIds((prev) => prev.map((id, i) => (i === index ? value : id)));
  }

  function buildAssignments(teacherIds: string[], label: string | null, textbookId: string | null) {
    return teacherIds.map((tid) => ({
      teacherProfileId: tid || null,
      label,
      textbookId,
    }));
  }

  function handleCellToggle(classId: string, periodId: string, day: number) {
    const key = `${classId}|${periodId}|${day}`;
    setPendingChanges((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, {
          teacherIds: toolTeacherIds.map((id) => id || null),
          label: toolLabel || null,
          textbookId: toolTextbookId || null,
        });
      }
      return next;
    });
  }

  async function handleSave() {
    if (pendingChanges.size === 0 && pendingDeletes.size === 0) return;
    setSaving(true);
    setError("");

    // 삭제 먼저
    for (const id of pendingDeletes) {
      const result = await deleteClassSchedule(id);
      if (result.error) { setError(result.error); setSaving(false); return; }
    }
    setPendingDeletes(new Set());

    // 1차 시도: 충돌 수집
    const conflictKeys: string[] = [];
    for (const [key, pending] of pendingChanges) {
      const [classId, periodId, dayStr] = key.split("|");
      const result = await setClassScheduleSlot(
        classId, periodId, parseInt(dayStr, 10),
        buildAssignments(pending.teacherIds.map((id) => id ?? ""), pending.label, pending.textbookId),
        false,
      );
      if (result.error?.startsWith("CONFLICT:")) {
        conflictKeys.push(key);
      } else if (result.error) {
        setError(result.error);
        setSaving(false);
        return;
      }
    }

    // 충돌이 있으면 모달로 확인
    if (conflictKeys.length > 0) {
      setSaving(false);
      setConflictKeys(conflictKeys);
      return;
    }

    setPendingChanges(new Map());
    await refreshData();
    router.refresh();
    setSaving(false);
  }

  async function handleConfirmMerge() {
    const keys = conflictKeys;
    setConflictKeys([]);
    setSaving(true);
    for (const key of keys) {
      const [classId, periodId, dayStr] = key.split("|");
      const pending = pendingChanges.get(key);
      if (!pending) continue;
      const result = await setClassScheduleSlot(
        classId, periodId, parseInt(dayStr, 10),
        buildAssignments(pending.teacherIds.map((id) => id ?? ""), pending.label, pending.textbookId),
        true,
      );
      if (result.error) { setError(result.error); setSaving(false); return; }
    }
    setPendingChanges(new Map());
    await refreshData();
    router.refresh();
    setSaving(false);
  }

  async function handleCancelMerge() {
    setConflictKeys([]);
    await refreshData();
    router.refresh();
  }

  function handleToggleDelete(scheduleIds: string[]) {
    setPendingDeletes((prev) => {
      const next = new Set(prev);
      const allPending = scheduleIds.every((id) => next.has(id));
      if (allPending) {
        scheduleIds.forEach((id) => next.delete(id));
      } else {
        scheduleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  const mergedData = useMemo(() => {
    const map = new Map<string, (MergedCell | null)[]>();
    for (const cls of data.classes) {
      for (const period of data.periods) {
        const key = `${cls.id}_${period.id}`;
        map.set(key, mergeConsecutiveDays(cls.id, period.id, data.cells));
      }
    }
    return map;
  }, [data]);

  const sortedTeachers = useMemo(
    () => [...data.teachers].sort((a, b) => a.name.localeCompare(b.name)),
    [data.teachers],
  );

  const teacherColorMap = useMemo(
    () => buildTeacherColorMap(sortedTeachers),
    [sortedTeachers],
  );

  const teacherNameMap = useMemo(
    () => new Map(data.teachers.map((t) => [t.id, t.name])),
    [data.teachers],
  );

  if (data.periods.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-slate-50/50 p-8 text-center text-sm text-muted-foreground">
        이 그룹에 등록된 교시가 없습니다. 먼저 교시 관리에서 교시를 추가해 주세요.
      </div>
    );
  }

  if (data.classes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-slate-50/50 p-8 text-center text-sm text-muted-foreground">
        이 그룹에 배정된 반이 없습니다. 반 관리에서 그룹을 지정해 주세요.
      </div>
    );
  }

  const nativeTeachers = data.teachers.filter((t) => t.teacher_type === "native");
  const koreanTeachers = data.teachers.filter((t) => t.teacher_type === "korean");

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {/* 배정 툴바 */}
      <div className="flex flex-col gap-2 p-3 bg-slate-50 rounded-xl border">
        {/* 선생님 행들 */}
        {toolTeacherIds.map((teacherId, idx) => (
          <div key={idx} className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium shrink-0 w-10">
              {idx === 0 ? "선생님" : "추가"}
            </span>
            <select
              value={teacherId}
              onChange={(e) => updateTeacherId(idx, e.target.value)}
              className="text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">없음</option>
              {nativeTeachers.length > 0 && (
                <optgroup label="원어민">
                  {nativeTeachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </optgroup>
              )}
              {koreanTeachers.length > 0 && (
                <optgroup label="한국인">
                  {koreanTeachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            {toolTeacherIds.length > 1 && (
              <button
                type="button"
                onClick={() => removeTeacherRow(idx)}
                className="text-xs px-2 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
              >
                제거
              </button>
            )}
          </div>
        ))}

        {/* 공유 과목 / 교재 */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium shrink-0 w-10">과목</span>
          <input
            type="text"
            placeholder="과목명"
            value={toolLabel}
            onChange={(e) => setToolLabel(e.target.value)}
            className="text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary w-24"
          />
          <span className="text-xs text-muted-foreground font-medium shrink-0">교재</span>
          <select
            value={toolTextbookId}
            onChange={(e) => setToolTextbookId(e.target.value)}
            className="text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary max-w-36"
          >
            <option value="">없음</option>
            {data.textbooks.map((tb) => (
              <option key={tb.id} value={tb.id}>
                {tb.series ? `[${tb.series}] ` : ""}{tb.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={addTeacherRow}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-dashed border-slate-300 text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            + 선생 추가
          </button>
          <div className="flex items-center gap-2 ml-auto">
            {(pendingChanges.size > 0 || pendingDeletes.size > 0) && (
              <button
                type="button"
                onClick={() => { setPendingChanges(new Map()); setPendingDeletes(new Set()); }}
                className="text-xs px-2.5 py-1.5 rounded-lg border text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                전체해제
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={(pendingChanges.size === 0 && pendingDeletes.size === 0) || saving}
              className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors font-medium"
            >
              {saving ? "저장 중…" : (pendingChanges.size + pendingDeletes.size) > 0 ? `저장 ${pendingChanges.size + pendingDeletes.size}건` : "저장"}
            </button>
          </div>
        </div>
      </div>

      {/* 교사 색상 범례 */}
      {sortedTeachers.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
          {sortedTeachers.map((t) => {
            const color = teacherColorMap.get(t.id);
            return (
              <span key={t.id} className="inline-flex items-center gap-1.5 text-xs">
                <span className={`w-3 h-3 rounded-sm ${color?.bg ?? "bg-slate-200"}`} />
                <span className="text-muted-foreground">{t.name}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* 시간표 그리드 */}
      <div className={`relative rounded-xl border shadow-sm overflow-x-auto transition-opacity ${saving ? "opacity-40 pointer-events-none select-none" : ""}`}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="py-3 px-3 text-left text-xs font-medium text-muted-foreground w-28 border-r">
                교시
              </th>
              {data.classes.map((cls) => (
                <th
                  key={cls.id}
                  className="py-3 px-3 text-center text-xs font-medium text-muted-foreground border-r last:border-r-0"
                >
                  {cls.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.periods.map((period) => (
              <tr key={period.id} className="border-b">
                <td className="py-0 px-3 border-r align-top">
                  <div className="py-2">
                    <div className="font-medium text-foreground text-xs">{period.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {period.start_time.slice(0, 5)}~{period.end_time.slice(0, 5)}
                    </div>
                  </div>
                </td>
                {data.classes.map((cls) => {
                  const mergedCells = mergedData.get(`${cls.id}_${period.id}`) ?? [];
                  return (
                    <td key={cls.id} className="py-0 px-0 border-r last:border-r-0 align-top">
                      <PeriodDayGrid
                        classId={cls.id}
                        periodId={period.id}
                        mergedCells={mergedCells}
                        pendingChanges={pendingChanges}
                        pendingDeletes={pendingDeletes}
                        onCellToggle={handleCellToggle}
                        onDeleteToggle={handleToggleDelete}
                        loading={loading || saving}
                        teacherColorMap={teacherColorMap}
                        teacherNameMap={teacherNameMap}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={conflictKeys.length > 0}
        title="통합 수업으로 배정하시겠습니까?"
        description={`선생님이 같은 시간에 이미 다른 반에 배정되어 있습니다.\n통합 수업으로 함께 배정하시겠습니까?`}
        confirmLabel="통합 배정"
        cancelLabel="취소"
        variant="primary"
        onConfirm={handleConfirmMerge}
        onCancel={handleCancelMerge}
      />
    </div>
  );
}

function PeriodDayGrid({
  classId,
  periodId,
  mergedCells,
  pendingChanges,
  pendingDeletes,
  onCellToggle,
  onDeleteToggle,
  loading,
  teacherColorMap,
  teacherNameMap,
}: {
  classId: string;
  periodId: string;
  mergedCells: (MergedCell | null)[];
  pendingChanges: Map<string, PendingCell>;
  pendingDeletes: Set<string>;
  onCellToggle: (classId: string, periodId: string, day: number) => void;
  onDeleteToggle: (scheduleIds: string[]) => void;
  loading: boolean;
  teacherColorMap: Map<string, { bg: string; text: string }>;
  teacherNameMap: Map<string, string>;
}) {
  const rows: React.ReactNode[] = [];
  let dayIndex = 1;

  for (const cell of mergedCells) {
    if (cell === null) {
      const day = dayIndex;
      const pendingKey = `${classId}|${periodId}|${day}`;
      const pending = pendingChanges.get(pendingKey);

      if (pending) {
        const firstId = pending.teacherIds[0];
        const color = firstId ? teacherColorMap.get(firstId) : undefined;
        const bgText = color ? `${color.bg} ${color.text}` : "bg-emerald-100 text-emerald-700";
        const names = pending.teacherIds.map((tid) => (tid ? (teacherNameMap.get(tid) ?? "") : "")).filter(Boolean).join(" · ");
        const display = [names, pending.label].filter(Boolean).join(" ") || "✓";
        rows.push(
          <button
            key={day}
            type="button"
            onClick={() => onCellToggle(classId, periodId, day)}
            className={`w-full text-left px-2 py-1 text-sm border-b last:border-b-0 font-medium transition-colors ring-2 ring-amber-400 ring-inset ${bgText}`}
            style={{ height: "24px" }}
          >
            <span className="truncate block leading-4">{display}</span>
          </button>,
        );
      } else {
        rows.push(
          <button
            key={day}
            type="button"
            onClick={() => onCellToggle(classId, periodId, day)}
            disabled={loading}
            className={`w-full text-left px-2 py-1 text-sm border-b last:border-b-0 transition-colors cursor-pointer ${DAY_COLORS[day].bg} hover:brightness-95`}
            style={{ height: "24px" }}
          >
            <span className={`${DAY_COLORS[day].text} opacity-40`}>{DAY_LABELS[day - 1]}</span>
          </button>,
        );
      }
      dayIndex++;
    } else {
      const height = cell.span * 24;
      const isPendingDelete = cell.scheduleIds.every((id) => pendingDeletes.has(id));

      if (isPendingDelete) {
        for (let d = cell.startDay; d < cell.startDay + cell.span; d++) {
          rows.push(
            <button
              key={d}
              type="button"
              onClick={() => onDeleteToggle(cell.scheduleIds)}
              className="w-full text-left px-2 py-1 text-sm border-b last:border-b-0 bg-red-50 transition-colors"
              style={{ height: "24px" }}
              title="클릭하여 삭제 취소"
            >
              <span className={`${DAY_COLORS[d]?.text ?? ""} opacity-30`}>{DAY_LABELS[d - 1]}</span>
            </button>,
          );
        }
        dayIndex += cell.span;
        continue;
      }

      const pendingKey = `${classId}|${periodId}|${cell.startDay}`;
      const pending = pendingChanges.get(pendingKey);

      // bg: first teacher's color (pending or existing)
      const firstEntry = cell.entries[0];
      const firstTeacherColor = firstEntry?.teacherId ? teacherColorMap.get(firstEntry.teacherId) : undefined;
      const existingBgClass = firstTeacherColor
        ? `${firstTeacherColor.bg} ${firstTeacherColor.text}`
        : firstEntry?.teacherName
          ? "bg-slate-200 text-slate-700"
          : "bg-slate-100/70 text-slate-500";

      if (pending) {
        // pending 덮어씌워 표시
        const firstPendingId = pending.teacherIds[0];
        const pendingColor = firstPendingId ? teacherColorMap.get(firstPendingId) : undefined;
        const pendingBgClass = pendingColor
          ? `${pendingColor.bg} ${pendingColor.text}`
          : "bg-emerald-100 text-emerald-700";
        const pendingHeight = height;
        const pendingNames = pending.teacherIds
          .map((tid) => (tid ? (teacherNameMap.get(tid) ?? "") : ""))
          .filter(Boolean)
          .join(" · ");

        rows.push(
          <div
            key={cell.startDay}
            className="relative group border-b last:border-b-0 cursor-pointer ring-2 ring-amber-400 ring-inset"
            style={{ height: `${pendingHeight}px` }}
            onClick={() => onCellToggle(classId, periodId, cell.startDay)}
          >
            <div className={`flex flex-col items-center justify-center h-full px-1 py-0.5 text-sm font-medium ${pendingBgClass} hover:brightness-95 transition-colors overflow-hidden`}>
              <span className="truncate block leading-4 text-center">
                {[pendingNames, pending.label].filter(Boolean).join(" ") || "—"}
              </span>
              {cell.span > 1 && (
                <span className="text-[9px] opacity-50">
                  ({DAY_LABELS[cell.startDay - 1]}~{DAY_LABELS[cell.startDay + cell.span - 2]})
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDeleteToggle(cell.scheduleIds); }}
              className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[8px] hover:bg-red-600 shadow-sm z-10"
              title="삭제"
            >
              ×
            </button>
          </div>,
        );
      } else {
        const teacherNames = cell.entries
          .map((e) => e.teacherName)
          .filter(Boolean)
          .join(" · ");
        const sharedLabel = cell.entries[0]?.label ?? null;

        rows.push(
          <div
            key={cell.startDay}
            className={`relative group border-b last:border-b-0 cursor-pointer`}
            style={{ height: `${height}px` }}
            onClick={() => onCellToggle(classId, periodId, cell.startDay)}
          >
            <div
              className={`flex flex-col items-center justify-center h-full px-1 py-0.5 text-sm font-medium ${existingBgClass} hover:brightness-95 transition-colors overflow-hidden`}
            >
              <span className="truncate block leading-4 text-center">
                {[teacherNames, sharedLabel].filter(Boolean).join(" ") || <span className="opacity-50">—</span>}
              </span>
              {cell.span > 1 && (
                <span className="text-[9px] opacity-50">
                  ({DAY_LABELS[cell.startDay - 1]}~{DAY_LABELS[cell.startDay + cell.span - 2]})
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDeleteToggle(cell.scheduleIds); }}
              className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[8px] hover:bg-red-600 shadow-sm z-10"
              title="삭제"
            >
              ×
            </button>
          </div>,
        );
      }
      dayIndex += cell.span;
    }
  }

  while (dayIndex <= 5) {
    const day = dayIndex;
    const pendingKey = `${classId}|${periodId}|${day}`;
    const pending = pendingChanges.get(pendingKey);

    if (pending) {
      const firstId = pending.teacherIds[0];
      const color = firstId ? teacherColorMap.get(firstId) : undefined;
      const bgText = color ? `${color.bg} ${color.text}` : "bg-emerald-100 text-emerald-700";
      const names = pending.teacherIds.map((tid) => (tid ? (teacherNameMap.get(tid) ?? "") : "")).filter(Boolean).join(" · ");
      const display = [names, pending.label].filter(Boolean).join(" ") || "✓";
      rows.push(
        <button
          key={day}
          type="button"
          onClick={() => onCellToggle(classId, periodId, day)}
          className={`w-full text-left px-2 py-1 text-sm border-b last:border-b-0 font-medium transition-colors ring-2 ring-amber-400 ring-inset ${bgText}`}
          style={{ height: "24px" }}
        >
          <span className="truncate block leading-4">{display}</span>
        </button>,
      );
    } else {
      rows.push(
        <button
          key={day}
          type="button"
          onClick={() => onCellToggle(classId, periodId, day)}
          disabled={loading}
          className={`w-full text-left px-2 py-1 text-sm border-b last:border-b-0 transition-colors cursor-pointer ${DAY_COLORS[day].bg} hover:brightness-95`}
          style={{ height: "24px" }}
        >
          <span className={`${DAY_COLORS[day].text} opacity-40`}>{DAY_LABELS[day - 1]}</span>
        </button>,
      );
    }
    dayIndex++;
  }

  return <div className="flex flex-col">{rows}</div>;
}

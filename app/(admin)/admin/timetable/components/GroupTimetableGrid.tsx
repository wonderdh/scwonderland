"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { GroupTimetableData } from "../../actions/schedule-actions";
import {
  getGroupTimetableGrid,
  addSingleClassSchedule,
  deleteClassSchedule,
} from "../../actions";

const DAY_LABELS = ["월", "화", "수", "목", "금"];

const LABEL_OPTIONS = ["Science", "Math", "Writing", "PE"];

const DAY_COLORS: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: "bg-red-50", text: "text-red-700", label: "월" },
  2: { bg: "bg-orange-50", text: "text-orange-700", label: "화" },
  3: { bg: "bg-yellow-50", text: "text-yellow-700", label: "수" },
  4: { bg: "bg-green-50", text: "text-green-700", label: "목" },
  5: { bg: "bg-blue-50", text: "text-blue-700", label: "금" },
};

type PendingCell = {
  teacherId: string | null;
  label: string | null;
  textbookId: string | null;
};

type MergedCell = {
  label: string | null;
  teacherId: string | null;
  teacherName: string | null;
  teacherType: "korean" | "native";
  scheduleIds: string[];
  startDay: number;
  span: number;
};

function mergeConsecutiveDays(
  classId: string,
  periodId: string,
  cells: GroupTimetableData["cells"],
): (MergedCell | null)[] {
  const result: (MergedCell | null)[] = [];
  let i = 1;
  while (i <= 5) {
    const key = `${classId}_${periodId}_${i}`;
    const cell = cells[key];
    if (!cell) {
      result.push(null);
      i++;
      continue;
    }
    let span = 1;
    const scheduleIds = [cell.scheduleId];
    while (i + span <= 5) {
      const nextKey = `${classId}_${periodId}_${i + span}`;
      const nextCell = cells[nextKey];
      if (
        nextCell &&
        nextCell.teacherName === cell.teacherName &&
        nextCell.label === cell.label
      ) {
        scheduleIds.push(nextCell.scheduleId);
        span++;
      } else {
        break;
      }
    }
    result.push({
      label: cell.label,
      teacherId: cell.teacherId,
      teacherName: cell.teacherName,
      teacherType: cell.teacherType,
      scheduleIds,
      startDay: i,
      span,
    });
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

  // Toolbar state
  const [toolTeacherId, setToolTeacherId] = useState("");
  const [toolLabel, setToolLabel] = useState("");
  const [toolTextbookId, setToolTextbookId] = useState("");

  // Pending changes: key = `${classId}|${periodId}|${day}`
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingCell>>(new Map());

  const refreshData = useCallback(async () => {
    const newData = await getGroupTimetableGrid(groupLabel);
    setData(newData);
  }, [groupLabel]);

  function handleCellToggle(classId: string, periodId: string, day: number) {
    const key = `${classId}|${periodId}|${day}`;
    setPendingChanges((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
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

  async function handleDeleteSchedule(scheduleIds: string[]) {
    if (!confirm("이 배정을 삭제하시겠습니까?")) return;
    setLoading(true);
    setError("");
    for (const id of scheduleIds) {
      const result = await deleteClassSchedule(id);
      if (result.error) {
        setError(result.error);
        break;
      }
    }
    await refreshData();
    router.refresh();
    setLoading(false);
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
      <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-xl border">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-medium shrink-0">선생님</span>
          <select
            value={toolTeacherId}
            onChange={(e) => setToolTeacherId(e.target.value)}
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
        </div>

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

      {/* 시간표 그리드 */}
      <div className="overflow-x-auto rounded-xl border shadow-sm">
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
                    <div className="text-[10px] text-muted-foreground">
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
                        onCellToggle={handleCellToggle}
                        onDeleteClick={handleDeleteSchedule}
                        loading={loading || saving}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PeriodDayGrid({
  classId,
  periodId,
  mergedCells,
  pendingChanges,
  onCellToggle,
  onDeleteClick,
  loading,
}: {
  classId: string;
  periodId: string;
  mergedCells: (MergedCell | null)[];
  pendingChanges: Map<string, PendingCell>;
  onCellToggle: (classId: string, periodId: string, day: number) => void;
  onDeleteClick: (scheduleIds: string[]) => void;
  loading: boolean;
}) {
  const rows: React.ReactNode[] = [];
  let dayIndex = 1;

  for (const cell of mergedCells) {
    if (cell === null) {
      const day = dayIndex;
      const pendingKey = `${classId}|${periodId}|${day}`;
      const pending = pendingChanges.get(pendingKey);

      if (pending) {
        rows.push(
          <button
            key={day}
            type="button"
            onClick={() => onCellToggle(classId, periodId, day)}
            className="w-full text-left px-2 py-1 text-[11px] border-b last:border-b-0 bg-emerald-100 text-emerald-700 font-medium transition-colors"
            style={{ height: "24px" }}
          >
            ✓
          </button>,
        );
      } else {
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
          </button>,
        );
      }
      dayIndex++;
    } else {
      const height = cell.span * 24;
      const hasTeacher = !!cell.teacherName;
      const hasLabel = !!cell.label;
      const bgClass = hasTeacher
        ? cell.teacherType === "native"
          ? "bg-blue-100/70 text-blue-700"
          : "bg-emerald-100/70 text-emerald-700"
        : "bg-slate-100/70 text-slate-600";

      const pendingKey = `${classId}|${periodId}|${cell.startDay}`;
      const pending = pendingChanges.get(pendingKey);
      const ringClass = pending ? "ring-2 ring-amber-400 ring-inset" : "";

      rows.push(
        <div
          key={cell.startDay}
          className={`relative group border-b last:border-b-0 cursor-pointer ${ringClass}`}
          style={{ height: `${height}px` }}
          onClick={() => onCellToggle(classId, periodId, cell.startDay)}
        >
          <div
            className={`flex flex-col items-center justify-center h-full px-1 text-[11px] font-medium ${bgClass} hover:brightness-95 transition-colors`}
          >
            {hasLabel && <span className="truncate text-[10px] opacity-80">{cell.label}</span>}
            {hasTeacher && <span className="truncate">{cell.teacherName}</span>}
            {!hasTeacher && !hasLabel && <span className="truncate opacity-50">—</span>}
            {cell.span > 1 && (
              <span className="text-[9px] opacity-50">
                ({DAY_LABELS[cell.startDay - 1]}~{DAY_LABELS[cell.startDay + cell.span - 2]})
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDeleteClick(cell.scheduleIds); }}
            className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[8px] hover:bg-red-600 shadow-sm z-10"
            title="삭제"
          >
            ×
          </button>
        </div>,
      );
      dayIndex += cell.span;
    }
  }

  while (dayIndex <= 5) {
    const day = dayIndex;
    const pendingKey = `${classId}|${periodId}|${day}`;
    const pending = pendingChanges.get(pendingKey);

    if (pending) {
      rows.push(
        <button
          key={day}
          type="button"
          onClick={() => onCellToggle(classId, periodId, day)}
          className="w-full text-left px-2 py-1 text-[11px] border-b last:border-b-0 bg-emerald-100 text-emerald-700 font-medium transition-colors"
          style={{ height: "24px" }}
        >
          ✓
        </button>,
      );
    } else {
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
        </button>,
      );
    }
    dayIndex++;
  }

  return <div className="flex flex-col">{rows}</div>;
}

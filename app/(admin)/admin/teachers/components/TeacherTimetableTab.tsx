"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { GroupTimetableData } from "@/lib/types";
import { CLASS_COLOR_PALETTE } from "@/lib/class-colors";
import {
  addSingleClassSchedule,
  deleteClassSchedule,
  getGroupTimetableGrid,
} from "../../actions";

type GroupKey = "유치부" | "오후반";

const GROUP_TABS: { key: GroupKey; label: string }[] = [
  { key: "유치부", label: "유치부 시간표" },
  { key: "오후반", label: "오후반 시간표" },
];

const DAY_LABELS = ["월", "화", "수", "목", "금"];


function buildClassColorMap(
  classes: { id: string; name: string }[],
): Map<string, { bg: string; text: string }> {
  const sorted = [...classes].sort((a, b) => a.name.localeCompare(b.name));
  const map = new Map<string, { bg: string; text: string }>();
  sorted.forEach((c, i) => {
    map.set(c.name, CLASS_COLOR_PALETTE[i % CLASS_COLOR_PALETTE.length]);
  });
  return map;
}

type PendingCell = {
  classId: string;
  teacherId: string;
  label: string | null;
  textbookId: string | null;
};

/**
 * For each period, returns a map of day → { className, scheduleId, classId } for this teacher.
 */
type DayAssignment = {
  classNames: string[];   // 모든 반 이름
  scheduleIds: string[];  // 모든 schedule ID (삭제 시 전부 처리)
  label: string | null;   // 첫 번째 반의 메모만 사용
};

function buildTeacherDaySchedule(
  data: GroupTimetableData,
  teacherProfileId: string,
): Map<string, Map<number, DayAssignment>> {
  const result = new Map<string, Map<number, DayAssignment>>();
  for (const period of data.periods) {
    const dayMap = new Map<number, DayAssignment>();
    for (const cls of data.classes) {
      for (let day = 1; day <= 5; day++) {
        const key = `${cls.id}_${period.id}_${day}`;
        const entries = data.cells[key];
        if (!entries?.length) continue;
        // 이 선생님이 포함된 항목만 찾기
        const match = entries.find((e) => e.teacherId === teacherProfileId);
        if (!match) continue;
        const existing = dayMap.get(day);
        if (existing) {
          existing.classNames.push(cls.name);
          existing.scheduleIds.push(match.scheduleId);
        } else {
          dayMap.set(day, { classNames: [cls.name], scheduleIds: [match.scheduleId], label: match.label });
        }
      }
    }
    result.set(period.id, dayMap);
  }
  return result;
}

export function TeacherTimetableTab({
  teacherProfileId,
  allGroupData,
}: {
  teacherProfileId: string;
  allGroupData: Record<string, GroupTimetableData>;
}) {
  const router = useRouter();
  const [activeGroup, setActiveGroup] = useState<GroupKey>("유치부");
  const [groupData, setGroupData] = useState(allGroupData);
  const data = groupData[activeGroup];

  // Toolbar state
  const [toolClassId, setToolClassId] = useState("");
  const [toolLabel, setToolLabel] = useState("");
  const [toolTextbookId, setToolTextbookId] = useState("");
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingCell>>(new Map());
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const refreshData = useCallback(async () => {
    const newData = await getGroupTimetableGrid(activeGroup);
    setGroupData((prev) => ({ ...prev, [activeGroup]: newData }));
  }, [activeGroup]);

  const teacherSchedule = useMemo(
    () => (data ? buildTeacherDaySchedule(data, teacherProfileId) : new Map()),
    [data, teacherProfileId],
  );

  const classColorMap = useMemo(
    () => buildClassColorMap(data?.classes ?? []),
    [data],
  );

  function handleCellToggle(periodId: string, day: number) {
    if (!toolClassId) return;
    const key = `${toolClassId}|${periodId}|${day}`;
    setPendingChanges((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, {
          classId: toolClassId,
          teacherId: teacherProfileId,
          label: toolLabel || null,
          textbookId: toolTextbookId || null,
        });
      }
      return next;
    });
  }

  function handleToggleDelete(scheduleId: string) {
    setPendingDeletes((prev) => {
      const next = new Set(prev);
      if (next.has(scheduleId)) next.delete(scheduleId);
      else next.add(scheduleId);
      return next;
    });
  }

  async function handleSave() {
    if (pendingChanges.size === 0 && pendingDeletes.size === 0) return;
    setSaving(true);
    setError("");

    for (const id of pendingDeletes) {
      const result = await deleteClassSchedule(id);
      if (result.error) { setError(result.error); setSaving(false); return; }
    }
    setPendingDeletes(new Set());

    // 1차 시도: 충돌 수집
    const conflictKeys: string[] = [];
    for (const [key, pending] of pendingChanges) {
      const [classId, periodId, dayStr] = key.split("|");
      const result = await addSingleClassSchedule(
        classId, periodId, parseInt(dayStr, 10),
        pending.teacherId, pending.label, pending.textbookId, null, false,
      );
      if (result.error?.startsWith("CONFLICT:")) {
        conflictKeys.push(key);
      } else if (result.error) {
        setError(result.error);
        setSaving(false);
        return;
      }
    }

    // 충돌이 있으면 한 번만 확인
    if (conflictKeys.length > 0) {
      setSaving(false);
      const ok = window.confirm(
        `선생님이 같은 시간에 이미 다른 반에 배정되어 있습니다.\n통합 수업으로 함께 배정하시겠습니까?`
      );
      if (!ok) {
        await refreshData();
        router.refresh();
        return;
      }
      setSaving(true);
      for (const key of conflictKeys) {
        const [classId, periodId, dayStr] = key.split("|");
        const pending = pendingChanges.get(key)!;
        const result = await addSingleClassSchedule(
          classId, periodId, parseInt(dayStr, 10),
          pending.teacherId, pending.label, pending.textbookId, null, true,
        );
        if (result.error) { setError(result.error); setSaving(false); return; }
      }
    }

    setPendingChanges(new Map());
    await refreshData();
    router.refresh();
    setSaving(false);
  }

  function handleGroupChange(key: GroupKey) {
    setActiveGroup(key);
    setPendingChanges(new Map());
    setPendingDeletes(new Set());
    setToolClassId("");
  }

  return (
    <div className="space-y-4">
      {/* 그룹 전환 탭 */}
      <div className="flex gap-1 border-b">
        {GROUP_TABS.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => handleGroupChange(g.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeGroup === g.key
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {/* 시간표 그리드 */}
      {!data || data.periods.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-slate-50/50 p-8 text-center text-sm text-muted-foreground">
          이 그룹에 등록된 교시가 없습니다.
        </div>
      ) : (
        <>
          {/* 배정 툴바 */}
          <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-xl border">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium shrink-0">반</span>
              <select
                value={toolClassId}
                onChange={(e) => setToolClassId(e.target.value)}
                className="text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">선택</option>
                {data.classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium shrink-0">과목</span>
              <input
                type="text"
                placeholder="과목명"
                value={toolLabel}
                onChange={(e) => setToolLabel(e.target.value)}
                className="text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary w-24"
              />
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

          <div className={`relative rounded-xl border shadow-sm overflow-x-auto transition-opacity ${saving ? "opacity-40 pointer-events-none select-none" : ""}`}>
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
                  const dayMap = teacherSchedule.get(period.id) ?? new Map();
                  return (
                    <tr key={period.id} className="border-b last:border-b-0">
                      <td className="py-2 px-3 border-r align-middle">
                        <div className="font-medium text-foreground text-xs">{period.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {period.start_time.slice(0, 5)}~{period.end_time.slice(0, 5)}
                        </div>
                      </td>
                      {[1, 2, 3, 4, 5].map((day) => {
                        const assigned = dayMap.get(day);
                        // 첫 번째 반 색상 기준
                        const color = assigned
                          ? (classColorMap.get(assigned.classNames[0]) ?? { bg: "bg-slate-200", text: "text-slate-700" })
                          : null;

                        // Check pending for any class in this slot
                        const pendingForSlot = [...pendingChanges.entries()].find(([k]) => {
                          const parts = k.split("|");
                          return parts[1] === period.id && parts[2] === String(day);
                        });

                        if (assigned) {
                          const isPendingDelete = assigned.scheduleIds.every((id: string) => pendingDeletes.has(id));
                          if (isPendingDelete) {
                            return (
                              <td
                                key={day}
                                className="py-2 px-2 border-r last:border-r-0 text-center align-middle"
                              >
                                <button
                                  type="button"
                                  onClick={() => assigned.scheduleIds.forEach((id: string) => handleToggleDelete(id))}
                                  className="w-full rounded-lg py-2 text-xs bg-red-50 text-muted-foreground/30 hover:bg-red-100 transition-colors"
                                  title="클릭하여 삭제 취소"
                                >
                                  —
                                </button>
                              </td>
                            );
                          }
                          // pending이 있으면 새 반/과목으로 덮어씌워 표시
                          const pendingClassId = pendingForSlot ? pendingForSlot[0].split("|")[0] : null;
                          const pendingClass = pendingClassId ? data?.classes.find((c) => c.id === pendingClassId) : null;
                          const pendingColor = pendingClass ? classColorMap.get(pendingClass.name) : null;
                          const pendingLabel = pendingForSlot ? pendingForSlot[1].label : null;
                          const displayColor = pendingForSlot
                            ? (pendingColor ?? { bg: "bg-slate-200", text: "text-slate-700" })
                            : color!;
                          const displayNames = pendingForSlot
                            ? [pendingClass?.name ?? assigned.classNames[0]]
                            : assigned.classNames;
                          const displayLabel = pendingForSlot ? pendingLabel : assigned.label;
                          return (
                            <td
                              key={day}
                              className="py-2 px-2 border-r last:border-r-0 text-center align-middle"
                            >
                              <div
                                className={`relative group rounded-lg p-1.5 text-xs font-medium cursor-pointer ${displayColor.bg} ${displayColor.text} ${
                                  pendingForSlot ? "ring-2 ring-amber-400 ring-inset" : ""
                                }`}
                                onClick={() => handleCellToggle(period.id, day)}
                              >
                                {displayNames.map((n: string, i: number) => (
                                  <div key={i} className="truncate">{n}</div>
                                ))}
                                {displayLabel && (
                                  <div className="text-[10px] opacity-70 truncate">{displayLabel}</div>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); assigned.scheduleIds.forEach((id: string) => handleToggleDelete(id)); }}
                                  className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[8px] hover:bg-red-600 shadow-sm z-10"
                                  title="삭제"
                                >
                                  ×
                                </button>
                              </div>
                            </td>
                          );
                        }

                        if (pendingForSlot) {
                          const pendingClassId = pendingForSlot[0].split("|")[0];
                          const pendingClass = data?.classes.find((c) => c.id === pendingClassId);
                          const pendingColor = pendingClass
                            ? classColorMap.get(pendingClass.name)
                            : undefined;
                          const pendingLabel = pendingForSlot[1].label;
                          return (
                            <td
                              key={day}
                              className="py-2 px-2 border-r last:border-r-0 text-center align-middle"
                            >
                              <button
                                type="button"
                                onClick={() => handleCellToggle(period.id, day)}
                                className={`w-full rounded-lg p-1.5 text-xs font-medium transition-colors ring-2 ring-amber-400 ring-inset ${
                                  pendingColor ? `${pendingColor.bg} ${pendingColor.text}` : "bg-emerald-100 text-emerald-700"
                                }`}
                              >
                                <div className="truncate">{pendingClass?.name ?? "✓"}</div>
                                {pendingLabel && <div className="text-[10px] opacity-70 truncate">{pendingLabel}</div>}
                              </button>
                            </td>
                          );
                        }

                        return (
                          <td
                            key={day}
                            className="py-2 px-2 border-r last:border-r-0 text-center align-middle"
                          >
                            <button
                              type="button"
                              onClick={() => handleCellToggle(period.id, day)}
                              disabled={saving || !toolClassId}
                              className="w-full rounded-lg py-2 text-xs text-muted-foreground/30 hover:bg-muted/50 transition-colors"
                            >
                              —
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

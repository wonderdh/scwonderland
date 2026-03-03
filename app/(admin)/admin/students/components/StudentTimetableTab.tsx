"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  getStudentTimetable,
  getStudentTimetableEditable,
  addSingleClassSchedule,
  deleteStudentSchedule,
} from "../../actions";
import type { StudentTimetableRow } from "@/lib/types";
import type { StudentTimetableEditData } from "../../actions/schedule-actions";

const DAY_NAMES = ["월", "화", "수", "목", "금"];

type GroupKey = "유치부" | "오후반" | "방과후";

const GROUP_TABS: { key: GroupKey; label: string }[] = [
  { key: "유치부", label: "유치부" },
  { key: "오후반", label: "오후반" },
  { key: "방과후", label: "방과후" },
];

function formatTime(t: string) {
  return t.slice(0, 5);
}

type PendingCell = {
  teacherId: string | null;
  label: string | null;
  textbookId: string | null;
};

export function StudentTimetableTab({
  studentProfileId,
}: {
  studentProfileId: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<StudentTimetableRow[]>([]);
  const [editData, setEditData] = useState<StudentTimetableEditData | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [activeGroup, setActiveGroup] = useState<GroupKey>("유치부");
  const [toolTeacherId, setToolTeacherId] = useState("");
  const [toolLabel, setToolLabel] = useState("");
  const [toolTextbookId, setToolTextbookId] = useState("");
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingCell>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [timetable, editable] = await Promise.all([
      getStudentTimetable(studentProfileId),
      getStudentTimetableEditable(studentProfileId),
    ]);
    setRows(timetable);
    setEditData(editable);
    setLoading(false);
  }, [studentProfileId]);

  useEffect(() => {
    load();
  }, [load]);

  // Filter class-based rows (source === "class")
  const classRows = useMemo(() => {
    return rows.filter((row) => {
      return Object.values(row.cells).some((cell) => cell && cell.source === "class");
    }).map((row) => ({
      ...row,
      cells: Object.fromEntries(
        Object.entries(row.cells).map(([day, cell]) => [
          day,
          cell && cell.source === "class" ? cell : null,
        ]),
      ) as typeof row.cells,
    })).filter((row) => Object.values(row.cells).some((c) => c !== null));
  }, [rows]);

  // Edit section: periods filtered by active group
  const groupPeriods = useMemo(() => {
    if (!editData) return [];
    return editData.periods
      .filter((p) => p.group_label === activeGroup)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [editData, activeGroup]);

  const nativeTeachers = useMemo(
    () => (editData?.teachers ?? []).filter((t) => t.teacher_type === "native"),
    [editData],
  );
  const koreanTeachers = useMemo(
    () => (editData?.teachers ?? []).filter((t) => t.teacher_type === "korean"),
    [editData],
  );

  function handleCellToggle(periodId: string, day: number) {
    const key = `${periodId}|${day}`;
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
      const [periodId, dayStr] = key.split("|");
      const result = await addSingleClassSchedule(
        null,
        periodId,
        parseInt(dayStr, 10),
        pending.teacherId,
        pending.label,
        pending.textbookId,
        studentProfileId,
      );
      if (result.error) {
        setError(result.error);
        hasError = true;
        break;
      }
    }
    if (!hasError) {
      setPendingChanges(new Map());
      await load();
      router.refresh();
    }
    setSaving(false);
  }

  async function handleDeleteIndividual(scheduleId: string) {
    if (!confirm("이 개인 배정을 삭제하시겠습니까?")) return;
    setError("");
    const result = await deleteStudentSchedule(scheduleId);
    if (result.error) {
      setError(result.error);
      return;
    }
    await load();
    router.refresh();
  }

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 반 기반 시간표 (읽기 전용) */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">반 기반 시간표</h3>
        {classRows.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            반 기반 배정이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="py-3 px-3 text-left text-xs font-medium text-muted-foreground w-28">
                    교시
                  </th>
                  {DAY_NAMES.map((name, i) => (
                    <th
                      key={i}
                      className="py-3 px-3 text-center text-xs font-medium text-muted-foreground"
                    >
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classRows.map((row) => (
                  <tr key={row.academy_period_id} className="border-b">
                    <td className="py-3 px-3 border-r">
                      <div className="font-medium text-foreground">
                        {row.period_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatTime(row.start_time)}~{formatTime(row.end_time)}
                      </div>
                    </td>
                    {[1, 2, 3, 4, 5].map((day) => {
                      const cell = row.cells[day];
                      if (!cell) {
                        return (
                          <td key={day} className="py-2 px-2 text-center">
                            <span className="text-muted-foreground/30">-</span>
                          </td>
                        );
                      }

                      // 셀 배경: 원어민=blue, 한국인=emerald, 교사 없음(Art/중국어 등)=amber
                      const cellBg = cell.teacher_name
                        ? cell.teacher_type === "native"
                          ? "bg-blue-50 border-blue-200"
                          : "bg-emerald-50 border-emerald-200"
                        : "bg-amber-50 border-amber-200";

                      return (
                        <td key={day} className="py-2 px-2 text-center">
                          <div className={`rounded-lg border p-2 ${cellBg}`}>
                            {cell.teacher_name && (
                              <div className={`text-xs font-semibold ${
                                cell.teacher_type === "native"
                                  ? "text-blue-700"
                                  : "text-emerald-700"
                              }`}>
                                {cell.teacher_name}
                              </div>
                            )}
                            {cell.label && (
                              <div className={`text-[10px] font-medium ${
                                cell.teacher_name ? "mt-0.5 text-slate-500" : "text-amber-700"
                              }`}>
                                {cell.label}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 개인 시간표 편집 */}
      {editData && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">개인 시간표</h3>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          {/* 그룹 탭 */}
          <div className="flex gap-1 border-b">
            {GROUP_TABS.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => { setActiveGroup(g.key); setPendingChanges(new Map()); }}
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
                {editData.textbooks.map((tb) => (
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

          {/* 개인 시간표 그리드 */}
          {groupPeriods.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-slate-50/50 p-8 text-center text-sm text-muted-foreground">
              이 그룹에 등록된 교시가 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border shadow-sm">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="py-3 px-3 text-left text-xs font-medium text-muted-foreground w-28 border-r">
                      교시
                    </th>
                    {DAY_NAMES.map((name, i) => (
                      <th
                        key={i}
                        className="py-3 px-3 text-center text-xs font-medium text-muted-foreground border-r last:border-r-0"
                      >
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupPeriods.map((period) => (
                    <tr key={period.id} className="border-b last:border-b-0">
                      <td className="py-2 px-3 border-r align-middle">
                        <div className="font-medium text-foreground text-xs">{period.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {formatTime(period.start_time)}~{formatTime(period.end_time)}
                        </div>
                      </td>
                      {[1, 2, 3, 4, 5].map((day) => {
                        const cellKey = `${period.id}_${day}`;
                        const pendingKey = `${period.id}|${day}`;
                        const existing = editData.cells[cellKey];
                        const pending = pendingChanges.get(pendingKey);

                        if (existing) {
                          return (
                            <td key={day} className="py-2 px-2 text-center align-middle border-r last:border-r-0">
                              <div
                                className={`relative group rounded-lg p-2 cursor-pointer transition-colors ${
                                  pending ? "ring-2 ring-amber-400 ring-inset bg-amber-50" : "bg-indigo-50 border border-indigo-200"
                                }`}
                                onClick={() => handleCellToggle(period.id, day)}
                              >
                                {existing.label && (
                                  <span className="block text-[10px] text-muted-foreground mb-0.5">
                                    {existing.label}
                                  </span>
                                )}
                                {existing.teacherName ? (
                                  <span
                                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
                                      existing.teacherType === "native"
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-emerald-100 text-emerald-700"
                                    }`}
                                  >
                                    {existing.teacherName}
                                  </span>
                                ) : !existing.label ? (
                                  <span className="text-xs text-muted-foreground">—</span>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteIndividual(existing.scheduleId); }}
                                  className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] hover:bg-red-600 shadow-sm"
                                  title="삭제"
                                >
                                  ×
                                </button>
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td key={day} className="py-2 px-2 text-center align-middle border-r last:border-r-0">
                            <button
                              type="button"
                              onClick={() => handleCellToggle(period.id, day)}
                              disabled={saving}
                              className={`w-full rounded-lg py-3 text-xs transition-colors ${
                                pending
                                  ? "bg-emerald-100 text-emerald-700 font-medium"
                                  : "text-muted-foreground/30 hover:bg-muted/50"
                              }`}
                            >
                              {pending ? "✓" : "-"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

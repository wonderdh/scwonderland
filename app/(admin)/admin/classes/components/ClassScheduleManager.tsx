"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type {
  ClassWithDetails,
  AcademyPeriod,
  TeacherOption,
} from "@/lib/types";
import {
  addSingleClassSchedule,
  deleteClassSchedule,
  listClassSchedules,
} from "../../actions";
import { LoadingState } from "@/components/LoadingState";
import { Spinner } from "@/components/Spinner";
import { GROUP_ORDER } from "@/lib/class-groups";

const DAY_LABELS = ["월", "화", "수", "목", "금"];

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

const SCHEDULE_GROUP_STYLE: Record<string, {
  icon: string;
  sectionBg: string;
  sectionText: string;
  countBg: string;
}> = {
  유치부: { icon: "🌅", sectionBg: "bg-amber-100", sectionText: "text-amber-800", countBg: "bg-amber-200 text-amber-800" },
  오후반: { icon: "☁️", sectionBg: "bg-sky-100", sectionText: "text-sky-800", countBg: "bg-sky-200 text-sky-800" },
  "": { icon: "📋", sectionBg: "bg-slate-100", sectionText: "text-slate-600", countBg: "bg-slate-200 text-slate-600" },
};


type TextbookOption = {
  id: string;
  title: string;
  series: string | null;
};

type PendingCell = {
  teacherId: string | null;
  label: string | null;
  textbookId: string | null;
};

type ScheduleCell = {
  scheduleId: string;
  teacherId: string | null;
  teacherName: string | null;
  teacherType: "korean" | "native";
  label: string | null;
  textbookId: string | null;
};

export function ClassScheduleManager({
  classes,
  teachers,
  periods,
  textbooks,
}: {
  classes: ClassWithDetails[];
  teachers: TeacherOption[];
  periods: AcademyPeriod[];
  textbooks: TextbookOption[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Toolbar state
  const [toolTeacherId, setToolTeacherId] = useState("");
  const [toolLabel, setToolLabel] = useState("");
  const [toolTextbookId, setToolTextbookId] = useState("");

  // Pending changes: key = `${periodId}|${day}`
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingCell>>(new Map());
  // Pending deletes: scheduleIds marked for deletion (applied on save)
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());

  // Existing schedules: key = `${periodId}_${day}`
  const [existingCells, setExistingCells] = useState<Map<string, ScheduleCell>>(new Map());

  const selectedClass = classes.find((c) => c.id === selectedClassId) ?? null;

  // Filter periods by group of selected class
  const classPeriods = useMemo(() => {
    if (!selectedClass) return [];
    const gl = selectedClass.group_label ?? "";
    return periods
      .filter((p) => p.group_label === gl && p.is_active)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [selectedClass, periods]);

  const filteredClasses = useMemo(() => {
    const nonAfterschool = classes.filter((c) => c.group_label !== "방과후");
    let result =
      groupFilter === "all"
        ? nonAfterschool
        : nonAfterschool.filter((c) => (c.group_label ?? "") === groupFilter);
    if (teacherFilter) result = result.filter((c) => c.teachers.some((t) => t.profile_id === teacherFilter));
    if (!search.trim()) return result;
    const q = search.trim().toLowerCase();
    return result.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.group_label && c.group_label.toLowerCase().includes(q)),
    );
  }, [classes, search, groupFilter, teacherFilter]);

  const groupedFilteredClasses = useMemo(() => {
    const map = new Map<string, ClassWithDetails[]>([
      ["유치부", []],
      ["오후반", []],
      ["", []],
    ]);
    for (const c of filteredClasses) {
      map.get(c.group_label ?? "")!.push(c);
    }
    return map;
  }, [filteredClasses]);

  const nativeTeachers = teachers.filter((t) => t.teacher_type === "native");
  const koreanTeachers = teachers.filter((t) => t.teacher_type === "korean");

  const sortedTeachers = useMemo(
    () => [...teachers].sort((a, b) => a.name.localeCompare(b.name)),
    [teachers],
  );

  const teacherColorMap = useMemo(
    () => buildTeacherColorMap(sortedTeachers),
    [sortedTeachers],
  );

  const toolTeacherName = teachers.find((t) => t.id === toolTeacherId)?.name ?? null;
  const toolTeacherColor = toolTeacherId ? teacherColorMap.get(toolTeacherId) : null;

  const loadSchedules = useCallback(async (classId: string) => {
    setLoading(true);
    const data = await listClassSchedules(classId);
    const map = new Map<string, ScheduleCell>();
    for (const s of data) {
      map.set(`${s.academy_period_id}_${s.day_of_week}`, {
        scheduleId: s.id,
        teacherId: s.teacher_profile_id,
        teacherName: s.teacher_name,
        teacherType: s.teacher_type,
        label: s.label,
        textbookId: s.textbook_id,
      });
    }
    setExistingCells(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadSchedules(selectedClassId);
    }
  }, [selectedClassId, loadSchedules]);

  function handleSelectClass(classId: string) {
    setSelectedClassId(classId);
    setError("");
    setPendingChanges(new Map());
    setPendingDeletes(new Set());
  }

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
    if (pendingChanges.size === 0 && pendingDeletes.size === 0) return;
    if (!selectedClassId) return;
    setSaving(true);
    setError("");

    // 삭제 먼저 처리
    if (pendingDeletes.size > 0) {
      const deleteResults = await Promise.all(
        [...pendingDeletes].map((id) => deleteClassSchedule(id)),
      );
      const deleteError = deleteResults.find((r) => r.error);
      if (deleteError) {
        setError(deleteError.error ?? "삭제 중 오류가 발생했습니다.");
        setSaving(false);
        return;
      }
    }

    // 추가 처리
    if (pendingChanges.size > 0) {
      const entries = [...pendingChanges.entries()];
      const results = await Promise.all(
        entries.map(([key, pending]) => {
          const [periodId, dayStr] = key.split("|");
          return addSingleClassSchedule(
            selectedClassId,
            periodId,
            parseInt(dayStr, 10),
            pending.teacherId,
            pending.label,
            pending.textbookId,
          );
        }),
      );
      const firstError = results.find((r) => r.error);
      if (firstError) {
        setError(firstError.error ?? "저장 중 오류가 발생했습니다.");
        setSaving(false);
        return;
      }
    }

    setPendingChanges(new Map());
    setPendingDeletes(new Set());
    await loadSchedules(selectedClassId);
    router.refresh();
    setSaving(false);
  }

  function handleDeleteCell(scheduleId: string) {
    setPendingDeletes((prev) => {
      const next = new Set(prev);
      if (next.has(scheduleId)) {
        next.delete(scheduleId); // 취소
      } else {
        next.add(scheduleId);
      }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* 왼쪽: 반 목록 */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="search"
              placeholder="반 이름 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-0 rounded-lg border border-input px-3 py-2 text-sm bg-background"
            />
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="rounded-lg border border-input px-2.5 py-2 text-sm text-foreground bg-background shrink-0"
            >
              <option value="all">전체</option>
              <option value="유치부">유치부</option>
              <option value="오후반">오후반</option>
              <option value="">미지정</option>
            </select>
          </div>
          <select
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
            className="w-full rounded-lg border border-input px-2.5 py-2 text-sm text-foreground bg-background"
          >
            <option value="">선생님 전체</option>
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
          <div className="max-h-[32rem] overflow-y-auto space-y-1.5 rounded-xl border p-2">
            {filteredClasses.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                검색 결과가 없습니다.
              </p>
            ) : (
              GROUP_ORDER.map((group) => {
                const groupClasses = groupedFilteredClasses.get(group) ?? [];
                if (groupClasses.length === 0) return null;
                const style = SCHEDULE_GROUP_STYLE[group];
                const label = group || "미지정";
                return (
                  <div key={group}>
                    <div className={`flex items-center gap-1.5 rounded px-2 py-1 mb-1 ${style.sectionBg}`}>
                      <span className="text-xs leading-none">{style.icon}</span>
                      <span className={`text-[11px] font-semibold ${style.sectionText}`}>{label}</span>
                      <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium ${style.countBg}`}>
                        {groupClasses.length}
                      </span>
                    </div>
                    {groupClasses.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectClass(c.id)}
                        className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                          selectedClassId === c.id
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted/50 text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium">{c.name}</span>
                          <span className="text-xs opacity-70">{c.student_count}명</span>
                        </div>
                        {c.teachers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {c.teachers.map((t) => {
                              const color = teacherColorMap.get(t.profile_id);
                              return (
                                <span
                                  key={t.profile_id}
                                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                    selectedClassId === c.id
                                      ? "bg-white/20 text-white"
                                      : `${color?.bg ?? "bg-slate-200"} ${color?.text ?? "text-slate-700"}`
                                  }`}
                                >
                                  {t.name}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 오른쪽: 툴바 + 그리드 */}
        <div className="lg:col-span-3">
          {!selectedClass ? (
            <div className="rounded-xl border border-dashed bg-slate-50/50 p-12 text-center text-sm text-slate-400">
              왼쪽에서 반을 선택하세요.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">
                  {selectedClass.name}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    수업 시간표
                  </span>
                </h3>
                {selectedClass.teachers.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-xs text-muted-foreground">담당:</span>
                    {selectedClass.teachers.map((t) => {
                      const color = teacherColorMap.get(t.profile_id);
                      return (
                        <span
                          key={t.profile_id}
                          className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${color?.bg ?? "bg-slate-200"} ${color?.text ?? "text-slate-700"}`}
                        >
                          {t.name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

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
                    {textbooks.map((tb) => (
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
                    onClick={handleSave}
                    disabled={(pendingChanges.size === 0 && pendingDeletes.size === 0) || saving}
                    className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors font-medium"
                  >
                    {saving ? <><Spinner size="sm" /> 저장 중…</> : (pendingChanges.size + pendingDeletes.size) > 0 ? `저장 ${pendingChanges.size + pendingDeletes.size}건` : "저장"}
                  </button>
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
              {loading ? (
                <LoadingState className="py-4" />
              ) : classPeriods.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-slate-50/50 p-8 text-center text-sm text-muted-foreground">
                  이 그룹에 등록된 교시가 없습니다.
                </div>
              ) : (
                <div className={`overflow-x-auto rounded-xl border shadow-sm transition-opacity ${saving ? "opacity-40 pointer-events-none" : ""}`}>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="py-3 px-3 text-left text-xs font-medium text-muted-foreground w-28 border-r">
                          교시
                        </th>
                        {DAY_LABELS.map((label, i) => (
                          <th
                            key={i}
                            className="py-3 px-3 text-center text-xs font-medium text-muted-foreground border-r last:border-r-0"
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {classPeriods.map((period) => (
                        <tr key={period.id} className="border-b last:border-b-0">
                          <td className="py-2 px-3 border-r align-middle">
                            <div className="font-medium text-foreground text-xs">{period.name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {period.start_time.slice(0, 5)}~{period.end_time.slice(0, 5)}
                            </div>
                          </td>
                          {[1, 2, 3, 4, 5].map((day) => {
                            const cellKey = `${period.id}_${day}`;
                            const pendingKey = `${period.id}|${day}`;
                            const existing = existingCells.get(cellKey);
                            const pending = pendingChanges.get(pendingKey);

                            // 셀 배경: 원어민=파란계열, 한국인=초록계열, 없음=기본
                            const savedBg = existing
                              ? existing.teacherId
                                ? existing.teacherType === "native"
                                  ? "bg-blue-50 border border-blue-200"
                                  : "bg-emerald-50 border border-emerald-200"
                                : "bg-slate-50 border border-slate-200"
                              : null;

                            const pendingTeacherType = pending?.teacherId
                              ? teachers.find((t) => t.id === pending.teacherId)?.teacher_type
                              : null;
                            const pendingBg = pendingTeacherType === "native"
                              ? "bg-blue-100"
                              : pendingTeacherType === "korean"
                              ? "bg-emerald-100"
                              : "bg-amber-50";

                            if (existing) {
                              const isPendingDelete = pendingDeletes.has(existing.scheduleId);
                              return (
                                <td key={day} className="py-2 px-2 text-center align-middle border-r last:border-r-0">
                                  <button
                                    type="button"
                                    className={`relative group w-full rounded-lg p-2 cursor-pointer transition-colors text-left ${
                                      isPendingDelete
                                        ? "bg-red-50 ring-2 ring-red-400 ring-inset"
                                        : pending ? `ring-2 ring-amber-400 ring-inset ${pendingBg}` : savedBg
                                    }`}
                                    onClick={() => handleCellToggle(period.id, day)}
                                  >
                                    {existing.label && (
                                      <span className={`block text-[10px] text-muted-foreground mb-0.5 ${isPendingDelete ? "line-through opacity-50" : ""}`}>
                                        {existing.label}
                                      </span>
                                    )}
                                    {existing.teacherName ? (
                                      <span
                                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
                                          isPendingDelete
                                            ? "bg-red-100 text-red-400 line-through"
                                            : existing.teacherId && teacherColorMap.has(existing.teacherId)
                                            ? `${teacherColorMap.get(existing.teacherId)!.bg} ${teacherColorMap.get(existing.teacherId)!.text}`
                                            : "bg-slate-200 text-slate-700"
                                        }`}
                                      >
                                        {existing.teacherName}
                                      </span>
                                    ) : !existing.label ? (
                                      <span className={`text-xs text-muted-foreground ${isPendingDelete ? "line-through opacity-50" : ""}`}>—</span>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleDeleteCell(existing.scheduleId); }}
                                      className={`absolute -top-1.5 -right-1.5 items-center justify-center w-5 h-5 rounded-full text-white text-[10px] shadow-sm ${
                                        isPendingDelete
                                          ? "flex bg-red-600 hover:bg-red-700"
                                          : "hidden group-hover:flex bg-red-500 hover:bg-red-600"
                                      }`}
                                      title={isPendingDelete ? "삭제 취소" : "삭제"}
                                    >
                                      {isPendingDelete ? "↩" : "×"}
                                    </button>
                                  </button>
                                </td>
                              );
                            }

                            return (
                              <td key={day} className="py-2 px-2 text-center align-middle border-r last:border-r-0">
                                <button
                                  type="button"
                                  onClick={() => handleCellToggle(period.id, day)}
                                  disabled={saving}
                                  className={`w-full rounded-lg py-2 text-xs transition-colors ${
                                    pending
                                      ? `${pendingBg} font-medium`
                                      : "text-muted-foreground/30 hover:bg-muted/50"
                                  }`}
                                >
                                  {pending ? (
                                    (() => {
                                      const pName = pending.teacherId ? teachers.find((t) => t.id === pending.teacherId)?.name : null;
                                      const pColor = pending.teacherId ? teacherColorMap.get(pending.teacherId) : null;
                                      return pName && pColor ? (
                                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${pColor.bg} ${pColor.text}`}>
                                          {pName}
                                        </span>
                                      ) : (
                                        <span className="text-emerald-700">✓</span>
                                      );
                                    })()
                                  ) : "-"}
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
      </div>
    </div>
  );
}

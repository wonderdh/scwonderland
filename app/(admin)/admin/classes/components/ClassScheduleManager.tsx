"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type {
  ClassWithDetails,
  AcademyPeriod,
  ClassScheduleWithDetails,
} from "@/lib/types";
import {
  listClassSchedules,
  addClassScheduleBatch,
  deleteClassSchedule,
} from "../../actions";

const DAY_LABELS = ["", "월", "화", "수", "목", "금"];

type TeacherOption = {
  id: string;
  name: string;
  teacher_type: "korean" | "native";
};

export function ClassScheduleManager({
  classes,
  teachers,
  periods,
}: {
  classes: ClassWithDetails[];
  teachers: TeacherOption[];
  periods: AcademyPeriod[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<ClassScheduleWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 추가 폼 state
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedClass = classes.find((c) => c.id === selectedClassId) ?? null;

  const filteredClasses = useMemo(() => {
    if (!search.trim()) return classes;
    const q = search.trim().toLowerCase();
    return classes.filter((c) => c.name.toLowerCase().includes(q));
  }, [classes, search]);

  const loadSchedules = useCallback(async (classId: string) => {
    setLoading(true);
    const data = await listClassSchedules(classId);
    setSchedules(data);
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
    setSelectedDays([]);
    setSelectedPeriodId("");
    setSelectedTeacherId("");
  }

  function toggleDay(day: number) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  async function handleAdd() {
    if (!selectedClassId) return;
    setSaving(true);
    setError("");
    const result = await addClassScheduleBatch(
      selectedClassId,
      selectedPeriodId,
      selectedDays,
      selectedTeacherId,
    );
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSelectedDays([]);
    setSelectedPeriodId("");
    setSelectedTeacherId("");
    await loadSchedules(selectedClassId);
    router.refresh();
  }

  async function handleDelete(scheduleId: string) {
    if (!confirm("이 수업 배정을 삭제하시겠습니까?")) return;
    setError("");
    const result = await deleteClassSchedule(scheduleId);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (selectedClassId) {
      await loadSchedules(selectedClassId);
      router.refresh();
    }
  }

  // 캘린더용: 사용된 교시 목록 (periods 기준, start_time 순)
  const usedPeriodIds = useMemo(
    () => new Set(schedules.map((s) => s.academy_period_id)),
    [schedules],
  );

  const calendarPeriods = useMemo(() => {
    return periods
      .filter((p) => usedPeriodIds.has(p.id))
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [periods, usedPeriodIds]);

  // (period_id, day) → schedule
  const scheduleMap = useMemo(() => {
    const map = new Map<string, ClassScheduleWithDetails>();
    for (const s of schedules) {
      map.set(`${s.academy_period_id}_${s.day_of_week}`, s);
    }
    return map;
  }, [schedules]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* 왼쪽: 반 목록 */}
      <div className="space-y-3">
        <input
          type="search"
          placeholder="반 이름 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-input px-3 py-2 text-sm bg-background"
        />
        <div className="max-h-[calc(100vh-260px)] overflow-y-auto space-y-1 rounded-xl border p-2">
          {filteredClasses.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              검색 결과가 없습니다.
            </p>
          )}
          {filteredClasses.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelectClass(c.id)}
              className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors ${
                selectedClassId === c.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted/50 text-foreground"
              }`}
            >
              <span className="font-medium">{c.name}</span>
              <span className="ml-2 text-xs opacity-70">
                {c.student_count}명
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 오른쪽: 캘린더 시간표 + 추가 폼 */}
      <div className="lg:col-span-2 space-y-4">
        {!selectedClass ? (
          <div className="rounded-xl border border-dashed bg-slate-50/50 p-12 text-center text-sm text-slate-400">
            왼쪽에서 반을 선택하세요.
          </div>
        ) : (
          <>
            <h3 className="text-base font-semibold text-foreground">
              {selectedClass.name}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                수업 시간표
              </span>
            </h3>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            {/* 캘린더 형식 시간표 */}
            {loading ? (
              <p className="text-sm text-muted-foreground py-4">
                불러오는 중...
              </p>
            ) : schedules.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                배정된 수업이 없습니다.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="py-3 px-3 text-left text-xs font-medium text-muted-foreground w-28">
                        교시
                      </th>
                      {[1, 2, 3, 4, 5].map((day) => (
                        <th
                          key={day}
                          className="py-3 px-3 text-center text-xs font-medium text-muted-foreground"
                        >
                          {DAY_LABELS[day]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {calendarPeriods.map((period) => (
                      <tr key={period.id} className="border-b">
                        <td className="py-3 px-3 border-r">
                          <div className="font-medium text-foreground">
                            {period.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {period.start_time.slice(0, 5)}~
                            {period.end_time.slice(0, 5)}
                          </div>
                        </td>
                        {[1, 2, 3, 4, 5].map((day) => {
                          const s = scheduleMap.get(`${period.id}_${day}`);
                          return (
                            <td
                              key={day}
                              className="py-2 px-2 text-center align-middle"
                            >
                              {s ? (
                                <div className="rounded-lg bg-primary/5 border border-primary/20 p-2 relative group">
                                  <span
                                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
                                      s.teacher_type === "native"
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-emerald-100 text-emerald-700"
                                    }`}
                                  >
                                    {s.teacher_name ?? "—"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(s.id)}
                                    className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] hover:bg-red-600 shadow-sm"
                                    title="삭제"
                                  >
                                    ×
                                  </button>
                                </div>
                              ) : (
                                <span className="text-muted-foreground/30">
                                  -
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 추가 폼 */}
            <div className="rounded-xl border bg-card p-4 space-y-4">
              <h4 className="text-sm font-semibold text-foreground">
                수업 추가
              </h4>

              {/* 요일 선택 */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  요일 선택
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        selectedDays.includes(day)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {DAY_LABELS[day]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 교시 선택 */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    교시
                  </label>
                  <select
                    value={selectedPeriodId}
                    onChange={(e) => setSelectedPeriodId(e.target.value)}
                    className="w-full rounded-lg border border-input px-3 py-2 text-sm bg-background"
                  >
                    <option value="">선택하세요</option>
                    {periods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.start_time.slice(0, 5)}~
                        {p.end_time.slice(0, 5)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 교사 선택 */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    담당 교사
                  </label>
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="w-full rounded-lg border border-input px-3 py-2 text-sm bg-background"
                  >
                    <option value="">선택하세요</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (
                        {t.teacher_type === "native" ? "원어민" : "한국인"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={
                    saving ||
                    selectedDays.length === 0 ||
                    !selectedPeriodId ||
                    !selectedTeacherId
                  }
                >
                  {saving ? "추가 중..." : "추가"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

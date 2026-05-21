"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  listClassUnitProgressDetailed,
  bulkMarkUnits,
  getAbsentStudentIds,
} from "@/app/(admin)/admin/actions";
import type {
  ClassUnitProgressDetailed,
  HomeworkClassPickerOption,
  UnitStatus,
} from "@/app/(admin)/admin/actions";
import type { TeacherOption } from "@/lib/types";
import { ClassUnitProgressList } from "@/components/homework/ClassUnitProgressList";
import { KST_DAY_LABELS } from "@/lib/utils/date-kst";
import { GROUP_TYPE_TO_LABEL } from "@/lib/constants/class";

type ClassOption = HomeworkClassPickerOption;

const GROUP_FILTERS: { value: string; label: string }[] = [
  { value: "kindergarten", label: GROUP_TYPE_TO_LABEL.kindergarten },
  { value: "afternoon", label: GROUP_TYPE_TO_LABEL.afternoon },
];

function defaultPeriodId(classes: ClassOption[]): string | null {
  for (const c of classes) {
    if (c.groupType !== "afternoon") continue;
    if (!c.periodId || !c.periodLabel || !c.periodStartTime) continue;
    if (c.periodLabel.includes("2:50") || c.periodStartTime.startsWith("14:50")) {
      return c.periodId;
    }
  }
  return null;
}

function buildSearchHaystack(c: ClassOption): string {
  const parts = [
    c.name,
    ...c.teacherNames,
    ...c.studentNames.flatMap((s) => [s.ko ?? "", s.en ?? ""]),
  ];
  return parts.join(" ").toLowerCase();
}

type Props = {
  classes: ClassOption[];
  initialClassId: string | null;
  initialData: ClassUnitProgressDetailed;
  teachers: TeacherOption[];
  initialAbsentStudentIds: string[];
  todayKst: string;
};

export function MobileHomeworkClient({
  classes,
  initialClassId,
  initialData,
  teachers,
  initialAbsentStudentIds,
  todayKst,
}: Props) {
  const router = useRouter();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(
    initialClassId
  );
  const [data, setData] = useState<ClassUnitProgressDetailed>(initialData);
  const [absentStudentIds, setAbsentStudentIds] = useState<ReadonlySet<string>>(
    () => new Set(initialAbsentStudentIds)
  );
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [koreanTeacherId, setKoreanTeacherId] = useState<string | null>(null);
  const [nativeTeacherId, setNativeTeacherId] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<Set<number>>(() => new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(
    () => new Set(["afternoon"])
  );
  const [selectedPeriods, setSelectedPeriods] = useState<Set<string>>(
    () => {
      const id = defaultPeriodId(classes);
      return id ? new Set([id]) : new Set();
    }
  );

  const koreanTeachers = useMemo(
    () => teachers.filter((t) => t.teacher_type === "korean"),
    [teachers]
  );
  const nativeTeachers = useMemo(
    () => teachers.filter((t) => t.teacher_type === "native"),
    [teachers]
  );
  const availableDays = useMemo(() => {
    const set = new Set<number>();
    for (const c of classes) for (const d of c.daysOfWeek) set.add(d);
    return [...set].sort((a, b) => a - b);
  }, [classes]);
  const availablePeriods = useMemo(() => {
    const map = new Map<string, { id: string; label: string; startTime: string }>();
    for (const c of classes) {
      if (c.groupType !== "afternoon") continue;
      if (!c.periodId || !c.periodLabel || !c.periodStartTime) continue;
      if (!map.has(c.periodId)) {
        map.set(c.periodId, {
          id: c.periodId,
          label: c.periodLabel,
          startTime: c.periodStartTime,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [classes]);

  const haystacks = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of classes) m.set(c.id, buildSearchHaystack(c));
    return m;
  }, [classes]);

  const filteredClasses = useMemo(() => {
    const q = search.trim().toLowerCase();
    const hasFilter =
      q.length > 0 ||
      koreanTeacherId !== null ||
      nativeTeacherId !== null ||
      selectedDays.size > 0 ||
      selectedGroups.size > 0 ||
      selectedPeriods.size > 0;
    if (!hasFilter) return classes;
    return classes.filter((c) => {
      if (c.id === selectedClassId) return true;
      if (q && !(haystacks.get(c.id) ?? "").includes(q)) return false;
      if (koreanTeacherId && !c.teacherIds.includes(koreanTeacherId)) return false;
      if (nativeTeacherId && !c.teacherIds.includes(nativeTeacherId)) return false;
      if (selectedDays.size > 0 && !c.daysOfWeek.some((d) => selectedDays.has(d)))
        return false;
      if (selectedGroups.size > 0 && !(c.groupType && selectedGroups.has(c.groupType)))
        return false;
      if (selectedPeriods.size > 0 && !(c.periodId && selectedPeriods.has(c.periodId)))
        return false;
      return true;
    });
  }, [
    classes,
    search,
    selectedClassId,
    haystacks,
    koreanTeacherId,
    nativeTeacherId,
    selectedDays,
    selectedGroups,
    selectedPeriods,
  ]);

  function toggleDay(day: number) {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function toggleGroup(group: string) {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  function togglePeriod(periodId: string) {
    setSelectedPeriods((prev) => {
      const next = new Set(prev);
      if (next.has(periodId)) next.delete(periodId);
      else next.add(periodId);
      return next;
    });
  }

  function handleClassChange(classId: string) {
    setSelectedClassId(classId);
    router.replace(`/m/homework?class=${classId}`, { scroll: false });
    startTransition(async () => {
      const [next, absentResult] = await Promise.all([
        listClassUnitProgressDetailed(classId),
        getAbsentStudentIds(todayKst),
      ]);
      setData(next);
      setAbsentStudentIds(new Set(absentResult.studentIds));
    });
  }

  async function reloadCurrentClass() {
    if (!selectedClassId) return;
    const next = await listClassUnitProgressDetailed(selectedClassId);
    setData(next);
  }

  async function handleSaveUnits(
    allChanges: {
      studentId: string;
      textbookId: string;
      changes: { unitNumber: number; status: UnitStatus }[];
    }[]
  ) {
    const records = allChanges.flatMap(({ studentId, textbookId, changes }) =>
      changes.map(({ unitNumber, status }) => ({ studentId, textbookId, unitNumber, status }))
    );
    const result = await bulkMarkUnits(records, { excludeAbsentOn: todayKst });
    if (result.error) {
      toast.error(result.error);
      await reloadCurrentClass();
      throw new Error(result.error);
    }
    const parts = [`저장 ${result.saved}건`];
    if (result.skippedAbsent > 0) parts.push(`결석자 ${result.skippedAbsent}건 제외`);
    toast.success(parts.join(" · "));
    setData((prev) => {
      const newByStudent = { ...prev.byStudent };
      for (const { studentId, textbookId, changes } of allChanges) {
        const list = newByStudent[studentId];
        if (!list) continue;
        newByStudent[studentId] = list.map((tb) => {
          if (tb.id !== textbookId) return tb;
          return {
            ...tb,
            units: tb.units.map((u) => {
              const change = changes.find((c) => c.unitNumber === u.unitNumber);
              if (!change) return u;
              return {
                ...u,
                status: change.status,
                completedAt: change.status === "completed" ? new Date().toISOString() : null,
              };
            }),
          };
        });
      }
      return { ...prev, byStudent: newByStudent };
    });
  }

  if (classes.length === 0) {
    return (
      <div className="rounded-xl border bg-card py-12 text-center">
        <p className="text-sm text-muted-foreground">반이 없습니다.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          데스크탑에서 반을 먼저 생성하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {/* 검색 */}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="반 이름 / 학생 한글·영어 이름 / 선생님 이름으로 검색"
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-slate-400"
        />

        {/* 필터 패널 */}
        {(koreanTeachers.length > 0 ||
          nativeTeachers.length > 0 ||
          availableDays.length > 0 ||
          availablePeriods.length > 0) && (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            {/* 반 구분 */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="shrink-0 text-xs font-semibold text-slate-500 w-16">
                반 구분
              </span>
              {GROUP_FILTERS.map((g) => {
                const active = selectedGroups.has(g.value);
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => toggleGroup(g.value)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:border-primary/50 hover:text-primary"
                    }`}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>

            {koreanTeachers.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="shrink-0 text-xs font-semibold text-slate-500 w-16">
                  한국 선생님
                </span>
                {koreanTeachers.map((t) => {
                  const active = koreanTeacherId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setKoreanTeacherId(active ? null : t.id)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                        active
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-white text-slate-700 border-slate-200 hover:border-primary/50 hover:text-primary"
                      }`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            )}

            {nativeTeachers.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="shrink-0 text-xs font-semibold text-slate-500 w-16">
                  원어민
                </span>
                {nativeTeachers.map((t) => {
                  const active = nativeTeacherId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setNativeTeacherId(active ? null : t.id)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                        active
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-white text-slate-700 border-slate-200 hover:border-primary/50 hover:text-primary"
                      }`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            )}

            {availablePeriods.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="shrink-0 text-xs font-semibold text-slate-500 w-16">
                  시작 시간
                </span>
                {availablePeriods.map((p) => {
                  const active = selectedPeriods.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePeriod(p.id)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                        active
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-white text-slate-700 border-slate-200 hover:border-primary/50 hover:text-primary"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
                {selectedPeriods.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedPeriods(new Set())}
                    className="ml-1 text-xs text-slate-400 hover:text-slate-600 underline-offset-2 hover:underline"
                  >
                    초기화
                  </button>
                )}
              </div>
            )}

            {availableDays.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="shrink-0 text-xs font-semibold text-slate-500 w-16">
                  요일
                </span>
                {availableDays.map((d) => {
                  const active = selectedDays.has(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      className={`min-w-[36px] px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                        active
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-white text-slate-700 border-slate-200 hover:border-primary/50 hover:text-primary"
                      }`}
                    >
                      {KST_DAY_LABELS[d]}
                    </button>
                  );
                })}
                {selectedDays.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedDays(new Set())}
                    className="ml-1 text-xs text-slate-400 hover:text-slate-600 underline-offset-2 hover:underline"
                  >
                    초기화
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 반 선택 pill 버튼 */}
        {filteredClasses.length === 0 ? (
          <p className="text-xs text-slate-500">검색 결과가 없습니다.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {filteredClasses.map((cls) => (
              <button
                key={cls.id}
                type="button"
                onClick={() => handleClassChange(cls.id)}
                disabled={isPending}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  cls.id === selectedClassId
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:border-primary/50 hover:text-primary"
                } disabled:opacity-50`}
              >
                {cls.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <ClassUnitProgressList
        students={data.students}
        byStudent={data.byStudent}
        editable={true}
        onSave={handleSaveUnits}
        loading={isPending}
        absentStudentIds={absentStudentIds}
      />
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { ClassWithDetails, TeacherOption } from "@/lib/types";
import { TeacherBadges } from "@/components/badges/TeacherBadges";
import { GROUP_ORDER, GROUP_TYPE_TO_LABEL, type GroupKey } from "@/lib/constants/class";
import { KST_DAY_LABELS } from "@/lib/utils/date-kst";
import { ClassesExcelDownload } from "./ClassesExcelDownload";
import { formatStudentName } from "@/lib/utils/student-name";
import { filterChip } from "@/lib/ui/filter-chip";

type FlatClassStudent = {
  class_id: string;
  id: string;
  student_profile_id: string;
  korean_name: string | null;
  english_name: string | null;
};

const GROUP_STYLE: Record<GroupKey, {
  icon: string;
  label: string;
  headerBg: string;
  headerText: string;
  cardBorder: string;
  cardBg: string;
}> = {
  유치부: {
    icon: "🌅",
    label: "유치부",
    headerBg: "bg-amber-500",
    headerText: "text-white",
    cardBorder: "border-amber-200",
    cardBg: "bg-amber-50/60",
  },
  오후반: {
    icon: "☁️",
    label: "오후반",
    headerBg: "bg-sky-500",
    headerText: "text-white",
    cardBorder: "border-sky-200",
    cardBg: "bg-sky-50/60",
  },
  "": {
    icon: "📋",
    label: "미지정",
    headerBg: "bg-slate-400",
    headerText: "text-white",
    cardBorder: "border-slate-200",
    cardBg: "bg-slate-50/60",
  },
};

export function ClassesOverview({
  classes,
  allClassStudents,
  teachers,
}: {
  classes: ClassWithDetails[];
  allClassStudents: FlatClassStudent[];
  teachers: TeacherOption[];
}) {
  const [groupFilter, setGroupFilter] = useState("all");
  const [koreanTeacherId, setKoreanTeacherId] = useState<string | null>(null);
  const [nativeTeacherId, setNativeTeacherId] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<Set<number>>(() => new Set());

  const nativeTeachers = teachers.filter((t) => t.teacher_type === "native");
  const koreanTeachers = teachers.filter((t) => t.teacher_type === "korean");

  // 방과후 반 제외 (방과후 관리 페이지에서 별도 관리)
  const filteredOutClasses = useMemo(
    () => classes.filter((c) => GROUP_TYPE_TO_LABEL[c.group_type ?? ""] !== "방과후"),
    [classes],
  );

  const availableDays = useMemo(() => {
    const set = new Set<number>();
    for (const c of filteredOutClasses) for (const d of c.days_of_week) set.add(d);
    return [...set].sort((a, b) => a - b);
  }, [filteredOutClasses]);

  function toggleDay(day: number) {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  const studentsByClass = useMemo(() => {
    const map = new Map<string, FlatClassStudent[]>();
    for (const s of allClassStudents) {
      const list = map.get(s.class_id);
      if (list) list.push(s);
      else map.set(s.class_id, [s]);
    }
    return map;
  }, [allClassStudents]);

  const grouped = useMemo(() => {
    let filtered =
      groupFilter === "all"
        ? filteredOutClasses
        : filteredOutClasses.filter((c) => (GROUP_TYPE_TO_LABEL[c.group_type ?? ""] ?? "") === groupFilter);
    if (koreanTeacherId) {
      filtered = filtered.filter((c) =>
        c.teachers.some((t) => t.profile_id === koreanTeacherId),
      );
    }
    if (nativeTeacherId) {
      filtered = filtered.filter((c) =>
        c.teachers.some((t) => t.profile_id === nativeTeacherId),
      );
    }
    if (selectedDays.size > 0) {
      filtered = filtered.filter((c) =>
        c.days_of_week.some((d) => selectedDays.has(d)),
      );
    }
    const map = new Map<GroupKey, ClassWithDetails[]>();
    for (const g of GROUP_ORDER) map.set(g, []);
    for (const c of filtered) {
      const key = (GROUP_TYPE_TO_LABEL[c.group_type ?? ""] ?? "") as GroupKey;
      map.get(key)!.push(c);
    }
    return map;
  }, [filteredOutClasses, groupFilter, koreanTeacherId, nativeTeacherId, selectedDays]);

  const activeGroups = GROUP_ORDER.filter((g) => (grouped.get(g) ?? []).length > 0);

  if (filteredOutClasses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-slate-50/50 p-8 text-center text-sm text-muted-foreground">
        등록된 반이 없습니다.
      </div>
    );
  }

  // 드롭다운 옵션: 실제 존재하는 그룹만
  const existingGroups = GROUP_ORDER.filter((g) =>
    filteredOutClasses.some((c) => (GROUP_TYPE_TO_LABEL[c.group_type ?? ""] ?? "") === g)
  );

  return (
    <div className="space-y-6">
      {/* 필터 + 다운로드 */}
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="shrink-0 text-xs font-semibold text-slate-500 w-16">
              그룹
            </span>
            <button
              type="button"
              onClick={() => setGroupFilter("all")}
              className={filterChip(groupFilter === "all")}
            >
              전체 ({filteredOutClasses.length})
            </button>
            {existingGroups.map((g) => {
              const count = filteredOutClasses.filter(
                (c) => (GROUP_TYPE_TO_LABEL[c.group_type ?? ""] ?? "") === g,
              ).length;
              const active = groupFilter === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroupFilter(g)}
                  className={filterChip(active)}
                >
                  {GROUP_STYLE[g].icon} {GROUP_STYLE[g].label} ({count})
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
                    className={filterChip(active)}
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
                    className={filterChip(active)}
                  >
                    {t.name}
                  </button>
                );
              })}
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
                    className={filterChip(active, "min-w-[36px]")}
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
        <div className="shrink-0 pt-1">
          <ClassesExcelDownload classes={classes} allClassStudents={allClassStudents} />
        </div>
      </div>

      {/* 그룹별 섹션 */}
      {activeGroups.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-slate-50/50 p-8 text-center text-sm text-muted-foreground">
          해당 그룹의 반이 없습니다.
        </div>
      ) : (
        activeGroups.map((group) => {
          const groupClasses = grouped.get(group) ?? [];
          const style = GROUP_STYLE[group];
          return (
            <section key={group}>
              {/* 섹션 헤더 */}
              <div className={`flex items-center gap-3 rounded-xl px-4 py-3 mb-3 ${style.headerBg}`}>
                <span className="text-lg leading-none">{style.icon}</span>
                <h2 className={`font-bold text-base ${style.headerText}`}>{style.label}</h2>
                <span
                  className={`ml-auto rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-semibold ${style.headerText}`}
                >
                  {groupClasses.length}개 반
                </span>
              </div>

              {/* 카드 그리드 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupClasses.map((c) => {
                  const students = studentsByClass.get(c.id) ?? [];
                  return (
                    <div
                      key={c.id}
                      className={`rounded-xl border ${style.cardBorder} ${style.cardBg} p-4 shadow-sm hover:shadow-md transition-shadow`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-foreground">{c.name}</h3>
                        <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-medium text-foreground/70">
                          {c.student_count}명
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mb-3">
                        <span className="mr-1">담당:</span>
                        <TeacherBadges teachers={c.teachers} />
                      </div>
                      {students.length > 0 && (
                        <div className="border-t border-current/10 pt-2 space-y-0.5">
                          {students.map((s) => (
                            <div
                              key={s.id}
                              className="text-xs text-foreground/80 flex items-center gap-2 overflow-hidden"
                            >
                              <span className="truncate">
                                {formatStudentName(s, { fallback: "—" })}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { ClassWithDetails, TeacherOption } from "@/lib/types";
import { TeacherBadges } from "@/components/badges/TeacherBadges";
import { GROUP_ORDER, type GroupKey } from "@/lib/constants/class";
import { ClassesExcelDownload } from "./ClassesExcelDownload";
import { formatStudentName } from "@/lib/utils/student-name";

type FlatClassStudent = {
  class_id: string;
  id: string;
  student_profile_id: string;
  korean_name: string | null;
  english_name: string | null;
  student_number: string | null;
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
  const [teacherFilter, setTeacherFilter] = useState("");

  const nativeTeachers = teachers.filter((t) => t.teacher_type === "native");
  const koreanTeachers = teachers.filter((t) => t.teacher_type === "korean");

  // 방과후 반 제외 (방과후 관리 페이지에서 별도 관리)
  const filteredOutClasses = useMemo(
    () => classes.filter((c) => c.group_label !== "방과후"),
    [classes],
  );

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
        : filteredOutClasses.filter((c) => (c.group_label ?? "") === groupFilter);
    if (teacherFilter) {
      filtered = filtered.filter((c) => c.teachers.some((t) => t.profile_id === teacherFilter));
    }
    const map = new Map<GroupKey, ClassWithDetails[]>();
    for (const g of GROUP_ORDER) map.set(g, []);
    for (const c of filtered) {
      const key = (c.group_label ?? "") as GroupKey;
      map.get(key)!.push(c);
    }
    return map;
  }, [filteredOutClasses, groupFilter, teacherFilter]);

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
    filteredOutClasses.some((c) => (c.group_label ?? "") === g)
  );

  return (
    <div className="space-y-6">
      {/* 필터 + 다운로드 */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="rounded-lg border border-input px-3 py-1.5 text-sm text-foreground bg-background"
        >
          <option value="all">전체 ({filteredOutClasses.length}개 반)</option>
          {existingGroups.map((g) => {
            const count = filteredOutClasses.filter((c) => (c.group_label ?? "") === g).length;
            return (
              <option key={g} value={g}>
                {GROUP_STYLE[g].icon} {GROUP_STYLE[g].label} ({count}개 반)
              </option>
            );
          })}
        </select>
        <select
          value={teacherFilter}
          onChange={(e) => setTeacherFilter(e.target.value)}
          className="rounded-lg border border-input px-3 py-1.5 text-sm text-foreground bg-background"
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
        <div className="ml-auto">
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
                              <span className="text-muted-foreground shrink-0">
                                {s.student_number ?? "—"}
                              </span>
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

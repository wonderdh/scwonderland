"use client";

import { useState, useMemo } from "react";
import type { GroupTimetableData } from "@/lib/types";
import { CLASS_COLOR_PALETTE } from "@/lib/class-colors";

type GroupKey = "유치부" | "오후반";

const GROUP_TABS: {
  key: GroupKey;
  korean: string;
  native: string;
}[] = [
  { key: "유치부", korean: "유치부", native: "Kindergarten" },
  { key: "오후반", korean: "오후반", native: "Afternoon" },
];

const DAY_LABELS = {
  korean: ["월", "화", "수", "목", "금"],
  native: ["Mon", "Tue", "Wed", "Thu", "Fri"],
};


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

/**
 * For each period, returns a map of day → class name for this teacher.
 * Joins with " / " if teacher is assigned to multiple classes in the same slot.
 */
function buildTeacherDaySchedule(
  data: GroupTimetableData,
  teacherProfileId: string,
): Map<string, Map<number, string>> {
  const result = new Map<string, Map<number, string>>();
  for (const period of data.periods) {
    const dayMap = new Map<number, string>();
    for (const cls of data.classes) {
      for (let day = 1; day <= 5; day++) {
        const key = `${cls.id}_${period.id}_${day}`;
        const cells = data.cells[key];
        if (cells?.some((c) => c.teacherId === teacherProfileId)) {
          const existing = dayMap.get(day);
          dayMap.set(day, existing ? `${existing} / ${cls.name}` : cls.name);
        }
      }
    }
    result.set(period.id, dayMap);
  }
  return result;
}

export function TeacherAcademyTimetable({
  teacherProfileId,
  teacherType,
  allGroupData,
}: {
  teacherProfileId: string;
  teacherType: "korean" | "native";
  allGroupData: Record<string, GroupTimetableData>;
}) {
  const isNative = teacherType === "native";
  const dayLabels = isNative ? DAY_LABELS.native : DAY_LABELS.korean;

  const [activeGroup, setActiveGroup] = useState<GroupKey>("유치부");
  const data = allGroupData[activeGroup];

  const teacherSchedule = useMemo(
    () => (data ? buildTeacherDaySchedule(data, teacherProfileId) : new Map()),
    [data, teacherProfileId],
  );

  const classColorMap = useMemo(
    () => buildClassColorMap(data?.classes ?? []),
    [data],
  );

  return (
    <div className="space-y-4">
      {/* 그룹 탭 */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {GROUP_TABS.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => setActiveGroup(g.key)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors ${
              activeGroup === g.key
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {isNative ? g.native : g.korean}
          </button>
        ))}
      </div>

      {/* 시간표 그리드 */}
      {!data || data.periods.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-slate-50/50 p-8 text-center text-sm text-muted-foreground">
          {isNative
            ? "No periods registered for this group."
            : "이 그룹에 등록된 교시가 없습니다."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border shadow-sm">
          <table className="w-full text-sm border-collapse" style={{ minWidth: "360px" }}>
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="py-3 px-3 text-left text-xs font-medium text-muted-foreground border-r" style={{ width: "90px" }}>
                  {isNative ? "Period" : "교시"}
                </th>
                {dayLabels.map((label) => (
                  <th
                    key={label}
                    className="py-3 px-2 text-center text-xs font-medium text-muted-foreground border-r last:border-r-0"
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
                      <div className="font-medium text-foreground text-xs leading-tight">
                        {period.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {period.start_time.slice(0, 5)}~{period.end_time.slice(0, 5)}
                      </div>
                    </td>
                    {[1, 2, 3, 4, 5].map((day) => {
                      const assignedClass = dayMap.get(day);
                      const primaryClass = assignedClass?.split(" / ")[0];
                      const color = primaryClass
                        ? (classColorMap.get(primaryClass) ?? { bg: "bg-slate-200", text: "text-slate-700" })
                        : null;
                      return (
                        <td
                          key={day}
                          className={`py-2 px-1 border-r last:border-r-0 text-center text-xs font-medium align-middle ${
                            color
                              ? `${color.bg} ${color.text}`
                              : "bg-slate-50 text-muted-foreground/30"
                          }`}
                        >
                          {assignedClass ?? "—"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

"use client";
import { QueryTabNav } from "@/components/QueryTabNav";

export type TeacherTabId = "info" | "classes" | "timetable";

const TABS = [
  { id: "info", label: "선생정보" },
  { id: "classes", label: "담당 반" },
  { id: "timetable", label: "시간표" },
] as const satisfies { id: TeacherTabId; label: string }[];

export function TeacherTabNav({
  selectedId,
  currentTab,
}: {
  selectedId: string;
  currentTab: TeacherTabId;
}) {
  const base = `/admin/teachers?selected=${encodeURIComponent(selectedId)}`;

  return <QueryTabNav tabs={TABS} currentTab={currentTab} baseHref={base} />;
}

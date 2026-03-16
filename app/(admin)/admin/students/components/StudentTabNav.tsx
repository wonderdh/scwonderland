"use client";
import { QueryTabNav } from "@/components/QueryTabNav";

export type StudentTabId = "info" | "learning" | "report" | "textbook" | "timetable" | "attendance" | "bus";

const TABS = [
  { id: "info", label: "학생정보" },
  { id: "learning", label: "학습관리" },
  { id: "report", label: "리포트카드" },
  { id: "textbook", label: "교재" },
  { id: "timetable", label: "시간표" },
  { id: "attendance", label: "출결" },
  { id: "bus", label: "승하차" },
] as const satisfies { id: StudentTabId; label: string }[];

export function StudentTabNav({
  selectedId,
  currentTab,
}: {
  selectedId: string;
  currentTab: StudentTabId;
}) {
  const base = `/admin/students?selected=${encodeURIComponent(selectedId)}`;

  return <QueryTabNav tabs={TABS} currentTab={currentTab} baseHref={base} />;
}

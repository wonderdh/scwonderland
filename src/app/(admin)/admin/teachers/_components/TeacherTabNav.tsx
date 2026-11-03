"use client";
import { User, Users, Calendar } from "lucide-react";
import { QueryTabNav } from "@/components/navigation/QueryTabNav";

export type TeacherTabId = "info" | "classes" | "timetable";

const TABS = [
  { id: "info", label: "선생 정보", icon: User },
  { id: "classes", label: "담당 반", icon: Users },
  { id: "timetable", label: "시간표", icon: Calendar },
] as const satisfies { id: TeacherTabId; label: string; icon: typeof User }[];

export function TeacherTabNav({ selectedId, currentTab }: { selectedId: string; currentTab: TeacherTabId }) {
  return (
    <QueryTabNav
      tabs={TABS}
      currentTab={currentTab}
      baseHref={`/admin/teachers?selected=${encodeURIComponent(selectedId)}`}
      aria-label="선생 상세 탭"
    />
  );
}

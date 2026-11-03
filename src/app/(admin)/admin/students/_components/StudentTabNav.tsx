"use client";
import { Users, BookOpen, Calendar, Bus, BookMarked } from "lucide-react";
import { QueryTabNav } from "@/components/navigation/QueryTabNav";

export type StudentTabId = "basic" | "learning" | "schedule" | "bus" | "homework";

const TABS = [
  { id: "basic", label: "기본 정보", icon: Users },
  { id: "learning", label: "학습 & 리포트", icon: BookOpen },
  { id: "schedule", label: "시간표 & 출결", icon: Calendar },
  { id: "bus", label: "승하차", icon: Bus },
  { id: "homework", label: "숙제", icon: BookMarked },
] as const satisfies { id: StudentTabId; label: string; icon: typeof Users }[];

export function StudentTabNav({ selectedId, currentTab }: { selectedId: string; currentTab: StudentTabId }) {
  return (
    <QueryTabNav
      tabs={TABS}
      currentTab={currentTab}
      baseHref={`/admin/students?selected=${encodeURIComponent(selectedId)}`}
      aria-label="학생 상세 탭"
    />
  );
}

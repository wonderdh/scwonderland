"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { User, Users, Calendar } from "lucide-react";

export type TeacherTabId = "info" | "classes" | "timetable";

const TABS = [
  { id: "info", label: "선생 정보", Icon: User },
  { id: "classes", label: "담당 반", Icon: Users },
  { id: "timetable", label: "시간표", Icon: Calendar },
] as const satisfies { id: TeacherTabId; label: string; Icon: typeof User }[];

export function TeacherTabNav({
  selectedId,
  currentTab,
}: {
  selectedId: string;
  currentTab: TeacherTabId;
}) {
  const base = `/admin/teachers?selected=${encodeURIComponent(selectedId)}`;
  const [pendingTab, setPendingTab] = useState<TeacherTabId | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingTab(null);
  }, [currentTab]);

  const displayTab = pendingTab ?? currentTab;

  return (
    <nav className="flex border-b bg-card rounded-t-xl overflow-x-auto">
      {TABS.map((t) => {
        const isActive = displayTab === t.id;
        const Icon = t.Icon;
        return (
          <Link
            key={t.id}
            href={`${base}&tab=${t.id}`}
            onClick={() => setPendingTab(t.id)}
            className={`flex items-center gap-2 px-5 h-12 text-base font-medium transition-colors whitespace-nowrap border-b-[3px] ${
              isActive
                ? "bg-orange-50 text-orange-700 border-orange-500"
                : "text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Icon className="h-6 w-6 shrink-0" aria-hidden />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Users, BookOpen, Calendar, Bus } from "lucide-react";

export type StudentTabId = "basic" | "learning" | "schedule" | "bus";

const TABS = [
  { id: "basic", label: "기본 정보", Icon: Users },
  { id: "learning", label: "학습 & 리포트", Icon: BookOpen },
  { id: "schedule", label: "시간표 & 출결", Icon: Calendar },
  { id: "bus", label: "승하차", Icon: Bus },
] as const satisfies { id: StudentTabId; label: string; Icon: typeof Users }[];

export function StudentTabNav({
  selectedId,
  currentTab,
}: {
  selectedId: string;
  currentTab: StudentTabId;
}) {
  const base = `/admin/students?selected=${encodeURIComponent(selectedId)}`;
  const [pendingTab, setPendingTab] = useState<StudentTabId | null>(null);

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

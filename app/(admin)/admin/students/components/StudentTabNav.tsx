"use client";

import Link from "next/link";

export type StudentTabId = "info" | "learning" | "report" | "textbook" | "timetable" | "attendance" | "bus";

const TABS: { id: StudentTabId; label: string }[] = [
  { id: "info", label: "학생정보" },
  { id: "learning", label: "학습관리" },
  { id: "report", label: "리포트카드" },
  { id: "textbook", label: "교재" },
  { id: "timetable", label: "시간표" },
  { id: "attendance", label: "출결" },
  { id: "bus", label: "승하차" },
];

export function StudentTabNav({
  selectedId,
  currentTab,
}: {
  selectedId: string;
  currentTab: StudentTabId;
}) {
  const base = `/admin/students?selected=${encodeURIComponent(selectedId)}`;

  return (
    <nav className="flex border-b bg-card rounded-t-xl overflow-x-auto">
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={`${base}&tab=${t.id}`}
          className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
            currentTab === t.id
              ? "text-foreground border-b-2 border-primary bg-muted/50"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

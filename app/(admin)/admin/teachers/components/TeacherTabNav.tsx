"use client";

import Link from "next/link";

export type TeacherTabId = "info" | "classes" | "timetable";

const TABS: { id: TeacherTabId; label: string }[] = [
  { id: "info", label: "선생정보" },
  { id: "classes", label: "담당 반" },
  { id: "timetable", label: "시간표" },
];

export function TeacherTabNav({
  selectedId,
  currentTab,
}: {
  selectedId: string;
  currentTab: TeacherTabId;
}) {
  const base = `/admin/teachers?selected=${encodeURIComponent(selectedId)}`;

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

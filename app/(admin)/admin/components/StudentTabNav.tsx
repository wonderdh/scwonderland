"use client";

import Link from "next/link";

export type StudentTabId = "info" | "learning" | "report" | "textbook" | "coming";

const TABS: { id: StudentTabId; label: string }[] = [
  { id: "info", label: "학생정보" },
  { id: "learning", label: "학습관리" },
  { id: "report", label: "리포트카드" },
  { id: "textbook", label: "교재" },
  { id: "coming", label: "준비중" },
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
    <nav className="flex border-b border-slate-200 bg-white rounded-t-xl overflow-hidden mb-0">
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={`${base}&tab=${t.id}`}
          className={`px-4 py-3 text-sm font-medium transition-colors ${
            currentTab === t.id
              ? "text-slate-800 border-b-2 border-slate-800 bg-slate-50/80"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50/50"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

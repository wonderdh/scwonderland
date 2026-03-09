"use client";

import Link from "next/link";

export type BusTabId = "dashboard" | "monitoring" | "numbers" | "timeslots" | "requests" | "staff";

const TABS: { id: BusTabId; label: string }[] = [
  { id: "dashboard", label: "대시보드" },
  { id: "monitoring", label: "실시간 현황" },
  { id: "numbers", label: "호차 관리" },
  { id: "timeslots", label: "시간대 관리" },
  { id: "requests", label: "변경 요청" },
  { id: "staff", label: "담당자 관리" },
];

export function BusTabNav({ currentTab }: { currentTab: BusTabId }) {
  return (
    <nav className="flex border-b bg-card rounded-t-xl overflow-x-auto">
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={`/admin/bus?tab=${t.id}`}
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

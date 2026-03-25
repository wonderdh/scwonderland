"use client";

import Link from "next/link";

export type BusTabId = "stop-assign" | "student-assign" | "overview" | "dashboard" | "bus-manage" | "timeslots" | "requests" | "staff";

const TABS: { id: BusTabId; label: string }[] = [
  { id: "overview", label: "배정 현황" },
  { id: "dashboard", label: "대시보드" },
  { id: "requests", label: "변경 요청" },
  { id: "student-assign", label: "학생 배정" },
  { id: "stop-assign", label: "정류장 배치" },
  { id: "bus-manage", label: "호차/정류장" },
  { id: "timeslots", label: "시간대 관리" },
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

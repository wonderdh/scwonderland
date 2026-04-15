"use client";

import Link from "next/link";
import { CalendarCheck, RefreshCw, UserCog, Settings } from "lucide-react";
import type { ComponentType } from "react";

export type BusTabId = "today" | "requests" | "assignment" | "master";

const TABS: { id: BusTabId; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "today", label: "오늘 운행", icon: CalendarCheck },
  { id: "requests", label: "변경요청", icon: RefreshCw },
  { id: "assignment", label: "배정 관리", icon: UserCog },
  { id: "master", label: "마스터", icon: Settings },
];

export function BusTabNav({ currentTab }: { currentTab: BusTabId }) {
  return (
    <nav
      className="flex border-b bg-card rounded-t-xl overflow-x-auto"
      role="tablist"
      aria-label="승하차 관리 탭"
    >
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = currentTab === t.id;
        return (
          <Link
            key={t.id}
            href={`/admin/bus?tab=${t.id}`}
            role="tab"
            aria-selected={active}
            className={`flex items-center gap-2 px-5 h-12 text-base font-medium transition-colors whitespace-nowrap border-b-[3px] ${
              active
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

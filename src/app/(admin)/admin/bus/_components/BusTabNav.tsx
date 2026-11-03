"use client";
import { CalendarCheck, RefreshCw, UserCog, Settings } from "lucide-react";
import { QueryTabNav } from "@/components/navigation/QueryTabNav";

export type BusTabId = "today" | "requests" | "assignment" | "master";

const TABS = [
  { id: "today", label: "오늘 운행", icon: CalendarCheck },
  { id: "requests", label: "변경요청", icon: RefreshCw },
  { id: "assignment", label: "배정 관리", icon: UserCog },
  { id: "master", label: "마스터", icon: Settings },
] as const satisfies { id: BusTabId; label: string; icon: typeof Settings }[];

export function BusTabNav({ currentTab }: { currentTab: BusTabId }) {
  return <QueryTabNav tabs={TABS} currentTab={currentTab} baseHref="/admin/bus" aria-label="승하차 관리 탭" />;
}

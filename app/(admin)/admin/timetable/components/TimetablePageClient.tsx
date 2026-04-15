"use client";

import { useState } from "react";
import type { AcademyPeriod, GroupTimetableData } from "@/lib/types";
import { TimetableManager } from "./TimetableManager";
import { GroupTimetableGrid } from "./GroupTimetableGrid";
import { PageHeader } from "@/components/PageHeader";

type TabId = "periods" | "kindergarten" | "afternoon";

const TABS: { id: TabId; label: string; groupLabel?: string }[] = [
  { id: "periods", label: "교시 관리" },
  { id: "kindergarten", label: "유치부 시간표", groupLabel: "유치부" },
  { id: "afternoon", label: "오후반 시간표", groupLabel: "오후반" },
];

export function TimetablePageClient({
  academyPeriods,
  allGroupData,
}: {
  academyPeriods: AcademyPeriod[];
  allGroupData: Record<string, GroupTimetableData>;
}) {
  const [currentTab, setCurrentTab] = useState<TabId>("periods");
  const currentTabConfig = TABS.find((t) => t.id === currentTab)!;

  return (
    <div>
      <PageHeader
        title="시간표 관리"
        description="교시를 등록하고 유치부·오후반 시간표에 교사를 배정하세요."
      />

      {/* 탭 네비 */}
      <nav className="flex border-b bg-card rounded-t-xl overflow-x-auto mb-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setCurrentTab(t.id)}
            className={`px-5 py-3 text-base font-medium transition-colors whitespace-nowrap ${
              currentTab === t.id
                ? "text-foreground border-b-2 border-primary bg-muted/50"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* 탭 콘텐츠 */}
      <div className="rounded-b-xl border border-t-0 border-slate-200 bg-white p-6">
        {currentTab === "periods" && (
          <TimetableManager academyPeriods={academyPeriods} />
        )}
        {currentTab !== "periods" && currentTabConfig.groupLabel && (
          <GroupTimetableGrid
            key={currentTabConfig.groupLabel}
            groupLabel={currentTabConfig.groupLabel}
            initialData={allGroupData[currentTabConfig.groupLabel]}
          />
        )}
      </div>
    </div>
  );
}

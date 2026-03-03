import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { listAcademyPeriods, getGroupTimetableGrid } from "../actions";
import { TimetableManager } from "./components/TimetableManager";
import { GroupTimetableGrid } from "./components/GroupTimetableGrid";

type TabId = "periods" | "kindergarten" | "afternoon" | "afterschool";

const TABS: { id: TabId; label: string; groupLabel?: string }[] = [
  { id: "periods", label: "교시 관리" },
  { id: "kindergarten", label: "유치부 시간표", groupLabel: "유치부" },
  { id: "afternoon", label: "오후반 시간표", groupLabel: "오후반" },
  { id: "afterschool", label: "방과후 시간표", groupLabel: "방과후" },
];

function parseTab(tab: string | undefined): TabId {
  if (tab && (["periods", "kindergarten", "afternoon", "afterschool"] as string[]).includes(tab))
    return tab as TabId;
  return "periods";
}

export default async function AdminTimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/academy/login");

  const { tab } = await searchParams;
  const currentTab = parseTab(tab);
  const currentTabConfig = TABS.find((t) => t.id === currentTab)!;

  const academyPeriods = await listAcademyPeriods();

  // 그룹 시간표 데이터 (교시 관리 탭이 아닌 경우만)
  const gridData = currentTabConfig.groupLabel
    ? await getGroupTimetableGrid(currentTabConfig.groupLabel)
    : null;

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">시간표 관리</h1>

      {/* 탭 네비 */}
      <nav className="flex border-b bg-card rounded-t-xl overflow-x-auto mb-0">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={
              t.id === "periods"
                ? "/admin/timetable"
                : `/admin/timetable?tab=${t.id}`
            }
            className={`px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
              currentTab === t.id
                ? "text-foreground border-b-2 border-primary bg-muted/50"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {/* 탭 콘텐츠 */}
      <div className="rounded-b-xl border border-t-0 border-slate-200 bg-white p-6">
        {currentTab === "periods" && (
          <TimetableManager academyPeriods={academyPeriods} />
        )}
        {currentTab !== "periods" && gridData && (
          <GroupTimetableGrid
            groupLabel={currentTabConfig.groupLabel!}
            initialData={gridData}
          />
        )}
      </div>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { listBusNumbers, listBusTimeSlots, listBusStaff, listBusStops, listAllActiveStudentNames } from "../actions";
import { BusTabNav, type BusTabId } from "./components/BusTabNav";
import { BusTimeSlotsManager } from "./components/BusTimeSlotsManager";
import { BusDashboard } from "./components/BusDashboard";
import { BusChangeRequestsPanel } from "./components/BusChangeRequestsPanel";
import { BusStaffManager } from "./components/BusStaffManager";
import { BusOverviewPanel } from "./components/BusOverviewPanel";
import { BusStopAssignmentManager } from "./components/BusStopAssignmentManager";
import { BusStudentAssignmentManager } from "./components/BusStudentAssignmentManager";
import { BusManagePanel } from "./components/BusManagePanel";
import { BusExportButton } from "./components/BusExportButton";
const VALID_TABS: BusTabId[] = ["overview", "dashboard", "requests", "student-assign", "stop-assign", "bus-manage", "timeslots", "staff"];

function parseTab(tab: string | undefined): BusTabId {
  if (tab && VALID_TABS.includes(tab as BusTabId)) return tab as BusTabId;
  return "overview";
}

export default async function AdminBusPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/academy/login");

  const { tab } = await searchParams;
  const currentTab = parseTab(tab);

  const [busNumbers, busTimeSlots, busStaff, busStops, allStudentNames] = await Promise.all([
    listBusNumbers(),
    listBusTimeSlots(),
    currentTab === "staff" ? listBusStaff() : Promise.resolve([]),
    (currentTab === "stop-assign" || currentTab === "student-assign" || currentTab === "bus-manage") ? listBusStops() : Promise.resolve([]),
    currentTab === "student-assign" ? listAllActiveStudentNames() : Promise.resolve([]),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800">승하차 관리</h1>
        <BusExportButton />
      </div>
      <BusTabNav currentTab={currentTab} />
      <div className="rounded-b-xl border border-t-0 border-slate-200 bg-white p-6">
        {currentTab === "stop-assign" && <BusStopAssignmentManager busNumbers={busNumbers} busTimeSlots={busTimeSlots} initialStops={busStops} />}
        {currentTab === "student-assign" && <BusStudentAssignmentManager busNumbers={busNumbers} busTimeSlots={busTimeSlots} initialStops={busStops} allStudents={allStudentNames} />}
        {currentTab === "overview" && <BusOverviewPanel busNumbers={busNumbers} busTimeSlots={busTimeSlots} />}
        {currentTab === "dashboard" && <BusDashboard busTimeSlots={busTimeSlots} busNumbers={busNumbers} />}
        {currentTab === "bus-manage" && <BusManagePanel busNumbers={busNumbers} busTimeSlots={busTimeSlots} initialStops={busStops} />}
        {currentTab === "timeslots" && <BusTimeSlotsManager busTimeSlots={busTimeSlots} />}
        {currentTab === "requests" && <BusChangeRequestsPanel adminId={user.id} />}
        {currentTab === "staff" && <BusStaffManager busStaff={busStaff} busNumbers={busNumbers} />}
      </div>
    </div>
  );
}

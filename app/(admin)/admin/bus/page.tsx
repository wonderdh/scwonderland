import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { listBusNumbers, listBusTimeSlots, listBusStaff } from "../actions";
import { BusTabNav, type BusTabId } from "./components/BusTabNav";
import { BusNumbersManager } from "./components/BusNumbersManager";
import { BusTimeSlotsManager } from "./components/BusTimeSlotsManager";
import { BusDashboard } from "./components/BusDashboard";
import { BusChangeRequestsPanel } from "./components/BusChangeRequestsPanel";
import { BusStaffManager } from "./components/BusStaffManager";
import { BusMonitoringDashboard } from "./components/BusMonitoringDashboard";

const VALID_TABS: BusTabId[] = ["dashboard", "monitoring", "numbers", "timeslots", "requests", "staff"];

function parseTab(tab: string | undefined): BusTabId {
  if (tab && VALID_TABS.includes(tab as BusTabId)) return tab as BusTabId;
  return "dashboard";
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

  const [busNumbers, busTimeSlots, busStaff] = await Promise.all([
    listBusNumbers(),
    listBusTimeSlots(),
    currentTab === "staff" ? listBusStaff() : Promise.resolve([]),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">승하차 관리</h1>
      <BusTabNav currentTab={currentTab} />
      <div className="rounded-b-xl border border-t-0 border-slate-200 bg-white p-6">
        {currentTab === "dashboard" && <BusDashboard busTimeSlots={busTimeSlots} />}
        {currentTab === "monitoring" && <BusMonitoringDashboard busTimeSlots={busTimeSlots} />}
        {currentTab === "numbers" && <BusNumbersManager busNumbers={busNumbers} />}
        {currentTab === "timeslots" && <BusTimeSlotsManager busTimeSlots={busTimeSlots} />}
        {currentTab === "requests" && <BusChangeRequestsPanel adminId={user.id} />}
        {currentTab === "staff" && <BusStaffManager busStaff={busStaff} busNumbers={busNumbers} />}
      </div>
    </div>
  );
}

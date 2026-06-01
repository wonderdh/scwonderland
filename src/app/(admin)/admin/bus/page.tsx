import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  listBusNumbers,
  listBusTimeSlots,
  listBusStops,
  listAllActiveStudentNames,
} from "@/app/(admin)/admin/actions/bus-actions";
import {
  listBusStaff,
} from "@/app/(admin)/admin/actions/bus-staff";
import { BusTabNav, type BusTabId } from "./_components/BusTabNav";
import { BusTimeSlotsManager } from "./_components/BusTimeSlotsManager";
import { BusDashboard } from "./_components/BusDashboard";
import { BusChangeRequestsPanel } from "./_components/BusChangeRequestsPanel";
import { BusStaffManager } from "./_components/BusStaffManager";
import { BusOverviewPanel } from "./_components/BusOverviewPanel";
import { BusStopAssignmentManager } from "./_components/BusStopAssignmentManager";
import { BusStudentAssignmentManager } from "./_components/BusStudentAssignmentManager";
import { BusNumbersManager } from "./_components/BusNumbersManager";
import { BusExportButton } from "./_components/BusExportButton";
import { DailyBusChanges } from "@/components/bus/DailyBusChanges";
import { PageHeader } from "@/components/navigation/PageHeader";

const VALID_TABS: BusTabId[] = ["today", "requests", "assignment", "master"];

function parseTab(tab: string | undefined): BusTabId {
  if (tab && VALID_TABS.includes(tab as BusTabId)) return tab as BusTabId;
  return "today";
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

  const needStaff = currentTab === "master";
  const needStops = currentTab === "assignment" || currentTab === "master" || currentTab === "requests";
  const needStudentNames = currentTab === "assignment" || currentTab === "requests";

  const [busNumbers, busTimeSlots, busStaff, busStops, allStudentNames] = await Promise.all([
    listBusNumbers(),
    listBusTimeSlots(),
    needStaff ? listBusStaff() : Promise.resolve([]),
    needStops ? listBusStops() : Promise.resolve([]),
    needStudentNames ? listAllActiveStudentNames() : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader
        title="승하차 관리"
        description="하원 운행 현황·변경요청·배정·기준 데이터를 관리합니다."
        actions={<BusExportButton />}
      />
      <BusTabNav currentTab={currentTab} />
      <div className="rounded-b-xl border border-t-0 border-slate-200 bg-white p-6">
        {currentTab === "today" && (
          <div className="space-y-8">
            <section aria-labelledby="today-overview">
              <h2 id="today-overview" className="text-lg font-semibold text-slate-800 mb-3">배정 현황</h2>
              <BusOverviewPanel busNumbers={busNumbers} busTimeSlots={busTimeSlots} />
            </section>
            <section aria-labelledby="today-dashboard">
              <h2 id="today-dashboard" className="text-lg font-semibold text-slate-800 mb-3">오늘 운행</h2>
              <BusDashboard busTimeSlots={busTimeSlots} />
            </section>
          </div>
        )}

        {currentTab === "requests" && (
          <BusChangeRequestsPanel
            adminId={user.id}
            initialStudents={allStudentNames}
            initialBusStops={busStops}
            initialBusTimeSlots={busTimeSlots}
          />
        )}

        {currentTab === "assignment" && (
          <div className="space-y-8">
            <section aria-labelledby="assignment-student">
              <h2 id="assignment-student" className="text-lg font-semibold text-slate-800 mb-3">학생 배정</h2>
              <BusStudentAssignmentManager
                busNumbers={busNumbers}
                busTimeSlots={busTimeSlots}
                initialStops={busStops}
                allStudents={allStudentNames}
              />
            </section>
            <section aria-labelledby="assignment-stop">
              <h2 id="assignment-stop" className="text-lg font-semibold text-slate-800 mb-3">정류장 배치</h2>
              <BusStopAssignmentManager
                busNumbers={busNumbers}
                busTimeSlots={busTimeSlots}
                initialStops={busStops}
              />
            </section>
          </div>
        )}

        {currentTab === "master" && (
          <div className="space-y-4">
            <details className="group rounded-xl border border-slate-200 bg-white" open>
              <summary className="cursor-pointer select-none px-5 py-4 text-lg font-semibold text-slate-800 flex items-center justify-between hover:bg-slate-50 rounded-xl">
                <span>호차 / 정류장 관리</span>
                <span className="text-sm text-slate-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="border-t border-slate-200 p-5">
                <BusNumbersManager
                  busNumbers={busNumbers}
                  busTimeSlots={busTimeSlots}
                  initialStops={busStops}
                />
              </div>
            </details>

            <details className="group rounded-xl border border-slate-200 bg-white">
              <summary className="cursor-pointer select-none px-5 py-4 text-lg font-semibold text-slate-800 flex items-center justify-between hover:bg-slate-50 rounded-xl">
                <span>시간대 관리</span>
                <span className="text-sm text-slate-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="border-t border-slate-200 p-5">
                <BusTimeSlotsManager busTimeSlots={busTimeSlots} />
              </div>
            </details>

            <details className="group rounded-xl border border-slate-200 bg-white">
              <summary className="cursor-pointer select-none px-5 py-4 text-lg font-semibold text-slate-800 flex items-center justify-between hover:bg-slate-50 rounded-xl">
                <span>담당자 관리</span>
                <span className="text-sm text-slate-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="border-t border-slate-200 p-5">
                <BusStaffManager busStaff={busStaff} busNumbers={busNumbers} />
              </div>
            </details>
          </div>
        )}
      </div>
      <div className="mt-6">
        <DailyBusChanges />
      </div>
    </div>
  );
}

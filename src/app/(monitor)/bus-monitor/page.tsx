import Link from "next/link";
import { listBusTimeSlots, getDailyBusManifest } from "@/app/(admin)/admin/actions";
import { getDateForIsoDayKst, getTodayIsoDayKst } from "@/lib/bus/monitor-date";
import { BusMonitorClient } from "./BusMonitorClient";

export default async function BusMonitorPage() {
  const initialIsoDay = getTodayIsoDayKst();
  const initialDate = getDateForIsoDayKst(initialIsoDay);

  const [busTimeSlots, initialManifest] = await Promise.all([
    listBusTimeSlots(),
    getDailyBusManifest(initialDate),
  ]);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex items-center gap-2 px-3 py-2">
        <Link
          href="/m"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          메뉴
        </Link>
      </div>
      <div className="px-1 pb-2">
        <BusMonitorClient
          busTimeSlots={busTimeSlots}
          initialIsoDay={initialIsoDay}
          initialGroups={initialManifest.groups}
        />
      </div>
    </div>
  );
}

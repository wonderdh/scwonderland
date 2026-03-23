import Link from "next/link";
import { listBusTimeSlots } from "@/app/(admin)/admin/actions";
import { BusMonitorClient } from "./BusMonitorClient";

export default async function BusMonitorPage() {
  const busTimeSlots = await listBusTimeSlots();

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
        <BusMonitorClient busTimeSlots={busTimeSlots} />
      </div>
    </div>
  );
}

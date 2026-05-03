import Link from "next/link";
import { AdminBusChangeDnD } from "@/app/(admin)/admin/bus/_components/AdminBusChangeDnD";
import {
  listAllActiveStudentNames,
  listBusStops,
  listBusTimeSlots,
} from "@/app/(admin)/admin/actions";

export default async function MobileBusChangePage() {
  const [students, busStops, busTimeSlots] = await Promise.all([
    listAllActiveStudentNames(),
    listBusStops(),
    listBusTimeSlots(),
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <Link
          href="/m"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-base font-semibold text-foreground">버스 당일변경</h1>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        <AdminBusChangeDnD
          initialStudents={students}
          initialBusStops={busStops}
          initialBusTimeSlots={busTimeSlots}
        />
      </div>
    </div>
  );
}

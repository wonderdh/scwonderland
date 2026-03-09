import { listBusTimeSlots } from "@/app/(admin)/admin/actions";
import { BusMonitorClient } from "./BusMonitorClient";

export default async function BusMonitorPage() {
  const busTimeSlots = await listBusTimeSlots();

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <BusMonitorClient busTimeSlots={busTimeSlots} />
    </div>
  );
}

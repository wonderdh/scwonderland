import { getCurrentBusStaffProfile } from "./actions";
import { redirect } from "next/navigation";
import { BusStaffMonitor } from "./_components/BusStaffMonitor";

export default async function BusPage() {
  const staff = await getCurrentBusStaffProfile();
  if (!staff) redirect("/login?next=/bus");

  return (
    <BusStaffMonitor busNumberId={staff.bus_number_id} />
  );
}

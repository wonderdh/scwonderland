import {
  getUpcomingReservations,
  listAllStudents,
  listBusNumbers,
  listBusTimeSlots,
} from "@/app/(admin)/admin/actions";
import { ReservationDashboard } from "./components/ReservationDashboard";

export default async function AdminReservationsPage() {
  const [reservations, students, busNumbers, busTimeSlots] = await Promise.all([
    getUpcomingReservations(30),
    listAllStudents(),
    listBusNumbers(),
    listBusTimeSlots(),
  ]);

  return (
    <ReservationDashboard
      initialReservations={reservations}
      students={students}
      busNumbers={busNumbers}
      busTimeSlots={busTimeSlots}
    />
  );
}

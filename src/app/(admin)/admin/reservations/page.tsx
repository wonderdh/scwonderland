import {
  getUpcomingReservations,
  listAllStudents,
  listBusNumbers,
  listBusTimeSlots,
} from "@/app/(admin)/admin/actions";
import { PageHeader } from "@/components/navigation/PageHeader";
import { ReservationDashboard } from "./_components/ReservationDashboard";

export default async function AdminReservationsPage() {
  const [reservations, students, busNumbers, busTimeSlots] = await Promise.all([
    getUpcomingReservations(30),
    listAllStudents(),
    listBusNumbers(),
    listBusTimeSlots(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="예약 현황"
        description="향후 30일 출결·버스 변경 예약을 한눈에 확인하고 관리합니다."
      />
      <ReservationDashboard
        initialReservations={reservations}
        students={students}
        busNumbers={busNumbers}
        busTimeSlots={busTimeSlots}
      />
    </div>
  );
}

import { listClassesWithDetails, listAllStudents } from "@/app/(admin)/admin/actions";
import { AdminAttendanceClient } from "./components/AdminAttendanceClient";
import { todayKst } from "@/lib/utils/date-kst";

export default async function AdminAttendancePage() {
  const [classes, allStudents] = await Promise.all([
    listClassesWithDetails(),
    listAllStudents(),
  ]);
  const today = todayKst();
  return <AdminAttendanceClient initialClasses={classes} allStudents={allStudents} today={today} />;
}

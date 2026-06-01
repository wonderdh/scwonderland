import { listClassesWithDetails } from "@/app/(admin)/admin/actions/class-actions";
import { listAllStudents } from "@/app/(admin)/admin/actions/user-actions";
import { MobileAttendanceClient } from "./_components/MobileAttendanceClient";
import { todayKst } from "@/lib/utils/date-kst";

export default async function MobileAttendancePage() {
  const [classes, allStudents] = await Promise.all([
    listClassesWithDetails(),
    listAllStudents(),
  ]);
  const today = todayKst();
  return <MobileAttendanceClient initialClasses={classes} allStudents={allStudents} today={today} />;
}

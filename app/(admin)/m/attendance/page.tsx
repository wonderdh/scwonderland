import { listClassesWithDetails, listAllStudents } from "@/app/(admin)/admin/actions";
import { MobileAttendanceClient } from "./components/MobileAttendanceClient";

export default async function MobileAttendancePage() {
  const [classes, allStudents] = await Promise.all([
    listClassesWithDetails(),
    listAllStudents(),
  ]);
  const today = new Date().toISOString().split("T")[0];
  return <MobileAttendanceClient initialClasses={classes} allStudents={allStudents} today={today} />;
}

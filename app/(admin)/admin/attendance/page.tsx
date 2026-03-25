import { listClassesWithDetails, listAllStudents } from "@/app/(admin)/admin/actions";
import { AdminAttendanceClient } from "./components/AdminAttendanceClient";

export default async function AdminAttendancePage() {
  const [classes, allStudents] = await Promise.all([
    listClassesWithDetails(),
    listAllStudents(),
  ]);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  return <AdminAttendanceClient initialClasses={classes} allStudents={allStudents} today={today} />;
}

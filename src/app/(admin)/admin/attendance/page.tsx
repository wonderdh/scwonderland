import { listClassesWithDetails, listAllStudents } from "@/app/(admin)/admin/actions";
import { AdminAttendanceClient } from "./_components/AdminAttendanceClient";
import { PageHeader } from "@/components/navigation/PageHeader";
import { todayKst } from "@/lib/utils/date-kst";

export default async function AdminAttendancePage() {
  const [classes, allStudents] = await Promise.all([
    listClassesWithDetails(),
    listAllStudents(),
  ]);
  const today = todayKst();
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 shrink-0">
        <PageHeader
          title="출결 관리"
          description="반별 또는 학생별로 출결 상태를 기록하고 수정하세요."
        />
      </div>
      <div className="flex-1 min-h-0">
        <AdminAttendanceClient initialClasses={classes} allStudents={allStudents} today={today} />
      </div>
    </div>
  );
}

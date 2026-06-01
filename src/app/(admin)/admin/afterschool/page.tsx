import {
  getOrCreateAfterschoolClass,
  getAfterschoolEnrollments,
  listAvailableStudents,
} from "@/app/(admin)/admin/actions/afterschool-actions";
import { AfterschoolPageClient } from "./_components/AfterschoolPageClient";

export default async function AdminAfterschoolPage() {
  const afterschoolClass = await getOrCreateAfterschoolClass();

  const [enrollments, available] = await Promise.all([
    getAfterschoolEnrollments(afterschoolClass.id),
    listAvailableStudents(afterschoolClass.id),
  ]);

  return (
    <div className="flex flex-1 min-w-0 flex-col p-6 md:p-8">
      <AfterschoolPageClient
        classId={afterschoolClass.id}
        initialEnrollments={enrollments}
        initialAvailable={available}
      />
    </div>
  );
}

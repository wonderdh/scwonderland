import {
  getOrCreateAfterschoolClass,
  getAfterschoolEnrollments,
} from "../actions";
import { AfterschoolPageClient } from "./_components/AfterschoolPageClient";

export default async function AdminAfterschoolPage() {
  const afterschoolClass = await getOrCreateAfterschoolClass();

  const enrollments = await getAfterschoolEnrollments(afterschoolClass.id);

  return (
    <div className="flex flex-1 min-w-0 flex-col p-6 md:p-8">
      <AfterschoolPageClient initialEnrollments={enrollments} />
    </div>
  );
}

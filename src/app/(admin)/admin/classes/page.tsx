import { redirect } from "next/navigation";
import {
  getAllClassStudentsFlat,
  listClassesWithDetails,
  listTeachersForSelect,
} from "@/app/(admin)/admin/actions/class-actions";
import {
  listAcademyPeriods,
} from "@/app/(admin)/admin/actions/timetable-actions";
import {
  listAllStudents,
} from "@/app/(admin)/admin/actions/user-actions";
import { ClassesPageClient } from "./_components/ClassesPageClient";

export default async function AdminClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  if (tab === "homework") redirect("/admin/homework?tab=class");

  const [classes, teachers, allClassStudents, allStudents, periods] =
    await Promise.all([
      listClassesWithDetails(),
      listTeachersForSelect(),
      getAllClassStudentsFlat(),
      listAllStudents(),
      listAcademyPeriods(),
    ]);

  return (
    <div className="flex flex-1 min-w-0 flex-col p-6 md:p-8">
      <ClassesPageClient
        initialClasses={classes}
        teachers={teachers}
        allClassStudents={allClassStudents}
        allStudents={allStudents}
        periods={periods}
      />
    </div>
  );
}

import { redirect } from "next/navigation";
import {
  getAllClassStudentsFlat,
  listAllStudents,
  listClassesWithDetails,
  listTeachersForSelect,
  listAcademyPeriods,
} from "../actions";
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

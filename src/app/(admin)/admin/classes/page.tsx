import {
  getAllClassStudentsFlat,
  listAllStudents,
  listClassesWithDetails,
  listTeachersForSelect,
  listAcademyPeriods,
  listTextbooks,
} from "../actions";
import { ClassesPageClient } from "./_components/ClassesPageClient";

export default async function AdminClassesPage() {
  const [classes, teachers, allClassStudents, allStudents, periods, textbooks] =
    await Promise.all([
      listClassesWithDetails(),
      listTeachersForSelect(),
      getAllClassStudentsFlat(),
      listAllStudents(),
      listAcademyPeriods(),
      listTextbooks(),
    ]);

  return (
    <div className="flex flex-1 min-w-0 flex-col p-6 md:p-8">
      <ClassesPageClient
        initialClasses={classes}
        teachers={teachers}
        allClassStudents={allClassStudents}
        allStudents={allStudents}
        periods={periods}
        textbooks={textbooks.map((tb) => ({ id: tb.id, title: tb.title, series: tb.series ?? null }))}
      />
    </div>
  );
}

import {
  getAllClassStudentsFlat,
  listAllStudents,
  listClassesWithDetails,
  listTeachersForSelect,
  listAcademyPeriods,
} from "../actions";
import { ClassesPageClient } from "./components/ClassesPageClient";

export default async function AdminClassesPage() {
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

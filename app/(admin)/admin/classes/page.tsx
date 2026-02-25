import {
  getAllClassStudentsFlat,
  listAllStudents,
  listClassesWithDetails,
  listTeachersForSelect,
} from "../actions";
import { ClassesManager } from "./components/ClassesManager";

export default async function AdminClassesPage() {
  const [classes, teachers, allClassStudents, allStudents] = await Promise.all([
    listClassesWithDetails(),
    listTeachersForSelect(),
    getAllClassStudentsFlat(),
    listAllStudents(),
  ]);

  return (
    <div className="flex flex-1 min-w-0 flex-col p-6 md:p-8">
      <ClassesManager
        initialClasses={classes}
        teachers={teachers}
        allClassStudents={allClassStudents}
        allStudents={allStudents}
      />
    </div>
  );
}

import {
  getAllClassStudentsFlat,
  listClassesWithDetails,
  listTeachersForSelect,
} from "../actions";
import { ClassesManager } from "./components/ClassesManager";

export default async function AdminClassesPage() {
  const classes = await listClassesWithDetails();
  const teachers = await listTeachersForSelect();
  const allClassStudents = await getAllClassStudentsFlat();

  return (
    <div className="flex flex-1 min-w-0 flex-col p-6 md:p-8">
      <ClassesManager
        initialClasses={classes}
        teachers={teachers}
        allClassStudents={allClassStudents}
      />
    </div>
  );
}

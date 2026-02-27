import { getCurrentTeacherProfile, getTeacherClasses } from "../../actions";
import { redirect } from "next/navigation";
import { TeacherAttendanceClient } from "./components/TeacherAttendanceClient";
import { attendanceLabels } from "@/lib/teacher-labels";

export default async function TeacherAttendancePage() {
  const profile = await getCurrentTeacherProfile();
  if (!profile) redirect("/academy/login");

  const classes = await getTeacherClasses();
  const L = attendanceLabels[profile.teacher_type];

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">{L.title}</h1>
      <TeacherAttendanceClient
        classes={classes}
        teacherType={profile.teacher_type}
      />
    </div>
  );
}

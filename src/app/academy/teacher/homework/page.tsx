import { getCurrentTeacherProfile, getTeacherClasses } from "../../actions";
import { redirect } from "next/navigation";
import { TeacherHomeworkClient } from "./_components/TeacherHomeworkClient";
import { homeworkLabels } from "@/lib/ui/teacher-labels";

export default async function TeacherHomeworkPage() {
  const profile = await getCurrentTeacherProfile();
  if (!profile) redirect("/academy/login");

  const classes = await getTeacherClasses();
  const simpleClasses = classes.map((c) => ({ id: c.id, name: c.name }));
  const L = homeworkLabels[profile.teacher_type];

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">{L.title}</h1>
      <TeacherHomeworkClient
        classes={simpleClasses}
        teacherId={profile.id}
        teacherType={profile.teacher_type}
      />
    </div>
  );
}

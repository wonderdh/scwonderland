import { getCurrentTeacherProfile, getTeacherClasses } from "../../actions";
import { redirect } from "next/navigation";
import { TeacherNoticesClient } from "./_components/TeacherNoticesClient";

export default async function TeacherNoticesPage() {
  const profile = await getCurrentTeacherProfile();
  if (profile?.teacher_type === "native") {
    redirect("/academy/teacher");
  }

  const classes = await getTeacherClasses();
  const simpleClasses = classes.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">반별 공지사항</h1>
      <TeacherNoticesClient
        classes={simpleClasses}
        teacherId={profile!.id}
      />
    </div>
  );
}

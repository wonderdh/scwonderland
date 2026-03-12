import { getCurrentStudentProfile } from "../../actions";
import { redirect } from "next/navigation";
import { StudentTimetableClient } from "./StudentTimetableClient";

export default async function StudentTimetablePage() {
  const profile = await getCurrentStudentProfile();
  if (!profile) redirect("/academy/login");

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">시간표</h1>
      <StudentTimetableClient
        studentProfileId={profile.id}
        studentName={profile.korean_name || profile.english_name || ""}
      />
    </div>
  );
}

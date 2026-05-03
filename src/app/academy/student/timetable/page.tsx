import { getCurrentStudentProfile } from "../../actions";
import { redirect } from "next/navigation";
import { StudentTimetableClient } from "./StudentTimetableClient";
import { formatStudentName } from "@/lib/utils/student-name";

export default async function StudentTimetablePage() {
  const profile = await getCurrentStudentProfile();
  if (!profile) redirect("/academy/login");

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">시간표</h1>
      <StudentTimetableClient
        studentProfileId={profile.id}
        studentName={formatStudentName(profile, { fallback: "" })}
      />
    </div>
  );
}

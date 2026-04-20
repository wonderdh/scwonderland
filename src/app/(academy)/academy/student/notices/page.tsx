import { getCurrentStudentProfile } from "../../actions";
import { redirect } from "next/navigation";
import { StudentNoticesClient } from "./StudentNoticesClient";

export default async function StudentNoticesPage() {
  const profile = await getCurrentStudentProfile();
  if (!profile) redirect("/academy/login");

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">공지사항</h1>
      <StudentNoticesClient studentProfileId={profile.id} />
    </div>
  );
}

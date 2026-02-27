import { getCurrentStudentProfile } from "../../actions";
import { redirect } from "next/navigation";
import { StudentHomeworkClient } from "./StudentHomeworkClient";

export default async function StudentHomeworkPage() {
  const profile = await getCurrentStudentProfile();
  if (!profile) redirect("/academy/login");

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">숙제</h1>
      <StudentHomeworkClient studentProfileId={profile.id} />
    </div>
  );
}

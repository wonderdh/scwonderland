import { getCurrentTeacherProfile } from "../../actions";
import { redirect } from "next/navigation";
import { busLabels } from "@/lib/teacher-labels";
import { TeacherBusClient } from "./components/TeacherBusClient";

export default async function TeacherBusPage() {
  const profile = await getCurrentTeacherProfile();
  if (!profile) redirect("/academy/login");

  // 한국인 교사만 접근 가능
  if (profile.teacher_type === "native") redirect("/academy/teacher");

  const L = busLabels.korean;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">{L.title}</h1>
      <TeacherBusClient />
    </div>
  );
}

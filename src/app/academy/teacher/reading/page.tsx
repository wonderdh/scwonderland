import { redirect } from "next/navigation";
import { getCurrentTeacherProfile, getTeacherReadingStats } from "../../actions";
import { ReadingDashboard } from "@/components/reading/ReadingDashboard";

export default async function TeacherReadingPage() {
  const profile = await getCurrentTeacherProfile();
  if (!profile) redirect("/dashboard");

  const stats = await getTeacherReadingStats();

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">Raz 리딩</h1>
      <ReadingDashboard stats={stats} hrefBase="/academy/teacher/reading" />
    </div>
  );
}

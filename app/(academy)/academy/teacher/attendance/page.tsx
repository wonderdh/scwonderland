import { getCurrentTeacherProfile } from "../../actions";
import { redirect } from "next/navigation";
import { attendanceLabels } from "@/lib/teacher-labels";

export default async function TeacherAttendancePage() {
  const profile = await getCurrentTeacherProfile();
  if (!profile) redirect("/academy/login");

  const L = attendanceLabels[profile.teacher_type];
  const isNative = profile.teacher_type === "native";

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">{L.title}</h1>
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-10 text-center">
        <div className="text-3xl mb-3">🚧</div>
        <p className="text-sm font-medium text-slate-600">
          {isNative ? "Attendance feature is coming soon." : "출결 기능은 준비 중입니다."}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {isNative ? "Please check back later." : "관리자에게 문의해 주세요."}
        </p>
      </div>
    </div>
  );
}

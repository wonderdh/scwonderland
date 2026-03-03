import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentTeacherProfile } from "../../actions";
import { getGroupTimetableGrid } from "../../../../(admin)/admin/actions/schedule-actions";
import { TeacherAcademyTimetable } from "./TeacherAcademyTimetable";

export default async function TeacherTimetablePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/academy/login");

  const profile = await getCurrentTeacherProfile();
  if (!profile) redirect("/academy/dashboard");

  const [유치부, 오후반, 방과후] = await Promise.all([
    getGroupTimetableGrid("유치부"),
    getGroupTimetableGrid("오후반"),
    getGroupTimetableGrid("방과후"),
  ]);

  return (
    <TeacherAcademyTimetable
      teacherProfileId={user.id}
      teacherType={profile.teacher_type}
      allGroupData={{
        "유치부": 유치부,
        "오후반": 오후반,
        "방과후": 방과후,
      }}
    />
  );
}

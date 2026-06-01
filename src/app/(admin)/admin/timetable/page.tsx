import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  getGroupTimetableGrid,
} from "@/app/(admin)/admin/actions/schedule-actions";
import {
  listAcademyPeriods,
} from "@/app/(admin)/admin/actions/timetable-actions";
import { TimetablePageClient } from "./_components/TimetablePageClient";

export default async function AdminTimetablePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/academy/login");

  const [academyPeriods, kindergartenData, afternoonData] =
    await Promise.all([
      listAcademyPeriods(),
      getGroupTimetableGrid("유치부"),
      getGroupTimetableGrid("오후반"),
    ]);

  return (
    <TimetablePageClient
      academyPeriods={academyPeriods}
      allGroupData={{
        "유치부": kindergartenData,
        "오후반": afternoonData,
      }}
    />
  );
}

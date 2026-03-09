import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { listAcademyPeriods, getGroupTimetableGrid } from "../actions";
import { TimetablePageClient } from "./components/TimetablePageClient";

export default async function AdminTimetablePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/academy/login");

  const [academyPeriods, kindergartenData, afternoonData, afterschoolData] =
    await Promise.all([
      listAcademyPeriods(),
      getGroupTimetableGrid("유치부"),
      getGroupTimetableGrid("오후반"),
      getGroupTimetableGrid("방과후"),
    ]);

  return (
    <TimetablePageClient
      academyPeriods={academyPeriods}
      allGroupData={{
        "유치부": kindergartenData,
        "오후반": afternoonData,
        "방과후": afterschoolData,
      }}
    />
  );
}

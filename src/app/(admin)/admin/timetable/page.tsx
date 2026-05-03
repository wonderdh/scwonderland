import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { listAcademyPeriods, getGroupTimetableGrid } from "../actions";
import { PageHeader } from "@/components/navigation/PageHeader";
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
    <div className="space-y-6">
      <PageHeader
        title="시간표 관리"
        description="유치부·오후반·방과후 시간표를 그룹별로 관리합니다."
      />
      <TimetablePageClient
        academyPeriods={academyPeriods}
        allGroupData={{
          "유치부": kindergartenData,
          "오후반": afternoonData,
        }}
      />
    </div>
  );
}

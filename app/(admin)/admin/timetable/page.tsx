import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { listAcademyPeriods } from "../actions";
import { TimetableManager } from "./components/TimetableManager";

export default async function AdminTimetablePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/academy/login");

  const academyPeriods = await listAcademyPeriods();

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-4">시간표 관리</h1>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <TimetableManager academyPeriods={academyPeriods} />
      </div>
    </div>
  );
}

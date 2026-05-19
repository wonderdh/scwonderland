import { getLunchSchedule } from "@/app/(admin)/admin/actions/lunch-actions";
import { LunchMonitorClient } from "./LunchMonitorClient";

export const metadata = {
  title: "점심지도 모니터",
};

type SearchParams = Promise<{ date?: string }>;

export default async function LunchMonitorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { date } = await searchParams;
  const { schedule, needsSetup } = await getLunchSchedule(date);

  if (needsSetup || !schedule) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">점심지도 모니터</h1>
          <p className="text-xl text-slate-400">
            관리자가 점심지도 대상 반을 지정해야 표시됩니다.
          </p>
        </div>
      </div>
    );
  }

  return <LunchMonitorClient schedule={schedule} />;
}

import Link from "next/link";
import {
  listClassesForHomeworkPicker,
  getAbsentStudentIds,
  listTextbooks,
} from "@/app/(admin)/admin/actions";
import { todayKst, todayDowKst } from "@/lib/utils/date-kst";
import { TodayPageClient } from "@/app/(admin)/admin/today/_components/TodayPageClient";

export default async function MobileTodayPage() {
  const today = todayKst();
  const todayDow = todayDowKst();
  const [classOptions, absentResult, textbooks] = await Promise.all([
    listClassesForHomeworkPicker(),
    getAbsentStudentIds(today),
    listTextbooks(),
  ]);

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <Link
          href="/m"
          className="rounded-md p-1.5 hover:bg-muted -ml-1 text-muted-foreground"
          aria-label="뒤로"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5 8.25 12l7.5-7.5"
            />
          </svg>
        </Link>
        <h1 className="text-base font-semibold text-foreground">오늘 수업</h1>
      </header>
      <div className="flex-1 px-3 py-3">
        <TodayPageClient
          classes={classOptions}
          todayKst={today}
          todayDow={todayDow}
          initialAbsentStudentIds={absentResult.studentIds}
          textbooks={textbooks}
          showHeader={false}
        />
      </div>
    </div>
  );
}

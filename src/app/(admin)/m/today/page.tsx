import Link from "next/link";
import { listClassesForHomeworkPicker } from "@/app/(admin)/admin/actions/class-actions";
import { getAbsentStudentIds } from "@/app/(admin)/admin/actions/homework-unit-actions";
import { listTextbooks } from "@/app/(admin)/admin/actions/textbook-actions";
import { todayKst, todayDowKst } from "@/lib/utils/date-kst";
import { TodayPageClient } from "@/app/(admin)/admin/today/_components/TodayPageClient";
import { ChevronLeft } from "lucide-react";

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
          <ChevronLeft className="w-5 h-5" />
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

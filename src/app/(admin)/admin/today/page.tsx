import {
  listClassesForHomeworkPicker,
  getAbsentStudentIds,
  listTextbooks,
} from "../actions";
import { todayKst, todayDowKst } from "@/lib/utils/date-kst";
import { PageHeader } from "@/components/navigation/PageHeader";
import { TodayPageClient } from "./_components/TodayPageClient";
import { Suspense } from "react";

export default async function AdminTodayPage() {
  const today = todayKst();
  const todayDow = todayDowKst();

  const [classList, absentResult, textbooks] = await Promise.all([
    listClassesForHomeworkPicker(),
    getAbsentStudentIds(today),
    listTextbooks(),
  ]);

  return (
    <div className="flex flex-1 min-w-0 flex-col p-6 md:p-8">
      <PageHeader
        title="오늘 수업"
        description="당일 시간대별 수업 반 — 출결·숙제 한 번에 체크."
      />
      <Suspense>
        <TodayPageClient
          classes={classList}
          todayKst={today}
          todayDow={todayDow}
          initialAbsentStudentIds={absentResult.studentIds}
          textbooks={textbooks}
        />
      </Suspense>
    </div>
  );
}

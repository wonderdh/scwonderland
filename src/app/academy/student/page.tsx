import { Suspense } from "react";
import { getCurrentStudentProfile } from "../actions";
import { Card, CardContent } from "@/components/ui/card";
import { nowKstParts } from "@/lib/utils/date-kst";
import {
  AttendanceWidget,
  StudentClassesCard,
  MonthlyStatsCard,
  WidgetSkeleton,
  MonthlyStatsCardSkeleton,
  ClassesCardSkeleton,
} from "./_components/DashboardWidgets";

export default async function StudentInfoPage() {
  const profile = await getCurrentStudentProfile();
  if (!profile) return null;

  const { year, month } = nowKstParts();
  const monthKstStart = `${year}-${String(month).padStart(2, "0")}-01`;

  return (
    <div className="space-y-6">
      {/* 프로필 카드 */}
      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-red-500 via-yellow-400 via-green-500 to-blue-500" />
        <CardContent className="-mt-10 pb-6">
          <div className="flex items-end gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-white text-orange-600 text-2xl font-bold shadow-lg ring-4 ring-white">
              {(profile.korean_name ?? "?")[0]}
            </div>
            <div className="pb-1 min-w-0">
              <h1 className="text-xl font-bold leading-snug">
                {profile.korean_name ?? "—"}
                {profile.english_name && (
                  <span className="text-muted-foreground font-normal text-base ml-2 whitespace-nowrap">
                    ({profile.english_name})
                  </span>
                )}
              </h1>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 대시보드 위젯 — 출석률 + 숙제 완료율 통합 */}
      <div className="grid grid-cols-1 gap-3">
        <Suspense fallback={<WidgetSkeleton />}>
          <AttendanceWidget profileId={profile.id} year={year} month={month} />
        </Suspense>
        <Suspense fallback={<MonthlyStatsCardSkeleton />}>
          <MonthlyStatsCard studentId={profile.id} monthKstStart={monthKstStart} month={month} />
        </Suspense>
      </div>

      {/* 소속 반 */}
      <Suspense fallback={<ClassesCardSkeleton />}>
        <StudentClassesCard />
      </Suspense>

      <p className="text-center text-xs text-muted-foreground">
        정보 수정이 필요하면 선생님 또는 관리자에게 문의하세요.
      </p>
    </div>
  );
}

import { getAttendanceStats } from "@/app/(admin)/admin/actions/attendance-actions";
import { getCurrentStudentClasses, getStudentMonthlyStats } from "../../actions";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SkeletonBone as Bone } from "@/components/skeletons/SkeletonBone";

export function WidgetSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <Bone className="h-4 w-20" />
        <Bone className="h-5 w-5 rounded-full" />
      </div>
      <Bone className="h-8 w-16" />
      <Bone className="h-3 w-24" />
    </div>
  );
}

export async function AttendanceWidget({
  profileId,
  year,
  month,
}: {
  profileId: string;
  year: number;
  month: number;
}) {
  const attendanceStats = await getAttendanceStats(profileId, year, month);
  const rate =
    attendanceStats.total > 0
      ? Math.round(
          ((attendanceStats.present + attendanceStats.late + (attendanceStats.early_leave ?? 0)) /
            attendanceStats.total) *
            100,
        )
      : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
        {month}월 출석률
      </span>
      <div className="mt-2 flex items-baseline gap-1">
        {rate != null ? (
          <>
            <span className="text-3xl font-bold text-sky-700">{rate}</span>
            <span className="text-sm text-slate-500">%</span>
          </>
        ) : (
          <span className="text-sm text-slate-500">기록 없음</span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        출석 {attendanceStats.present} · 지각 {attendanceStats.late} · 결석 {attendanceStats.absent}
      </p>
    </div>
  );
}

export function MonthlyStatsCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <Bone className="h-4 w-32" />
      <div className="grid grid-cols-2 gap-4 mt-2">
        <div className="space-y-1">
          <Bone className="h-8 w-16" />
          <Bone className="h-3 w-20" />
        </div>
        <div className="space-y-1">
          <Bone className="h-8 w-16" />
          <Bone className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}

export async function MonthlyStatsCard({
  studentId,
  monthKstStart,
  month,
}: {
  studentId: string;
  monthKstStart: string;
  month: number;
}) {
  const stats = await getStudentMonthlyStats(studentId, monthKstStart);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
        {month}월 통합 현황
      </span>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-baseline gap-1">
            {stats.attendance.total > 0 ? (
              <>
                <span className="text-3xl font-bold text-sky-700">{stats.attendance.rate}</span>
                <span className="text-sm text-slate-500">%</span>
              </>
            ) : (
              <span className="text-sm text-slate-500">기록 없음</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">출석률</p>
          <p className="text-xs text-slate-400">
            출석 {stats.attendance.present} · 지각 {stats.attendance.late} · 결석 {stats.attendance.absent}
          </p>
        </div>
        <div>
          <div className="flex items-baseline gap-1">
            {stats.homework.total > 0 ? (
              <>
                <span className="text-3xl font-bold text-emerald-700">{stats.homework.rate}</span>
                <span className="text-sm text-slate-500">%</span>
              </>
            ) : (
              <span className="text-sm text-slate-500">기록 없음</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            숙제 완료율 <span className="text-slate-400">(누적)</span>
          </p>
          <p className="text-xs text-slate-400">
            완료 {stats.homework.completed} · 미완 {stats.homework.missed}
          </p>
        </div>
      </div>
    </div>
  );
}

export function ClassesCardSkeleton() {
  return (
    <div className="rounded-xl border p-6 space-y-4">
      <Bone className="h-5 w-24" />
      <div className="space-y-3">
        <Bone className="h-12 w-full rounded-lg" />
        <Bone className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
}

export async function StudentClassesCard() {
  const classes = await getCurrentStudentClasses();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <svg
            className="size-5 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
            />
          </svg>
          소속 반
        </CardTitle>
      </CardHeader>
      <CardContent>
        {classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">소속된 반이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {classes.map((item, i) => (
              <div
                key={`${item.class_name}-${i}`}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-green-100 bg-gradient-to-r from-green-50/80 to-transparent px-4 py-3"
              >
                <span className="font-medium flex-1 min-w-0 truncate">{item.class_name}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {item.teachers.length === 0 ? (
                    <Badge
                      variant="outline"
                      className="bg-gray-50 text-gray-500 border-gray-200 whitespace-nowrap"
                    >
                      담당: 미지정
                    </Badge>
                  ) : (
                    item.teachers.map((t, ti) => (
                      <Badge
                        key={ti}
                        variant="outline"
                        className={`whitespace-nowrap ${
                          t.teacher_type === "native"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {t.name ?? "—"} ({t.teacher_type === "native" ? "원어민" : "한국인"})
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

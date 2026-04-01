import { getCurrentTeacherProfile, getTeacherClasses, getClassReportStatus } from "../actions";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { dashboardLabels } from "@/lib/teacher-labels";

const arrowIcon = (
  <svg className="size-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
  </svg>
);

export default async function TeacherMainPage() {
  const [profile, classes] = await Promise.all([
    getCurrentTeacherProfile(),
    getTeacherClasses(),
  ]);
  if (!profile) return null;

  const isNative = profile.teacher_type === "native";
  const L = dashboardLabels[profile.teacher_type];
  const totalStudents = classes.reduce((sum, c) => sum + c.students.length, 0);

  // 원어민 교사만 이번 달 리포트카드 작성 현황 조회
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const reportStatusMap = new Map<string, { written: number; total: number }>();
  if (isNative && classes.length > 0) {
    const statuses = await Promise.all(
      classes.map((cls) => getClassReportStatus(cls.id, currentYear, currentMonth))
    );
    classes.forEach((cls, i) => {
      const statusList = statuses[i];
      const total = statusList.length;
      const written = statusList.filter((s) => s.has_report).length;
      reportStatusMap.set(cls.id, { written, total });
    });
  }

  return (
    <div className="space-y-6">
      {/* 교사 프로필 */}
      <Card className="overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-red-500 via-yellow-400 via-green-500 to-blue-500" />
        <CardContent className="-mt-8 pb-6">
          <div className="flex items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div className="flex size-14 items-center justify-center rounded-full bg-white text-orange-600 text-xl font-bold shadow-lg ring-4 ring-white">
                {(profile.name ?? "T")[0]}
              </div>
              <div className="pb-1">
                <h1 className="text-xl font-bold">{profile.name ?? (isNative ? "Teacher" : "선생님")}</h1>
              </div>
            </div>
            <div className="flex gap-6 text-center pb-1">
              <div className="rounded-lg bg-orange-50 border border-orange-100 px-4 py-2">
                <p className="text-2xl font-bold text-orange-700">{classes.length}</p>
                <p className="text-xs text-orange-600 font-medium">{L.classes}</p>
              </div>
              <div className="rounded-lg bg-green-50 border border-green-100 px-4 py-2">
                <p className="text-2xl font-bold text-green-700">{totalStudents}</p>
                <p className="text-xs text-green-600 font-medium">{L.studentCount}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 담당 반 목록 */}
      {classes.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">{L.noClasses}</p>
            <p className="mt-1 text-xs text-muted-foreground">{L.contactAdmin}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {classes.map((cls) => (
            <Card key={cls.id} className="hover:shadow-md transition-shadow hover:border-orange-200">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-base">{cls.name}</CardTitle>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                      {cls.students.length}{isNative ? ` ${L.students}` : L.students}
                    </Badge>
                    {isNative && (() => {
                      const status = reportStatusMap.get(cls.id);
                      if (!status || status.total === 0) return null;
                      const allWritten = status.written === status.total;
                      return allWritten ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          {status.written}/{status.total} Written
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          {status.written}/{status.total} Written
                        </Badge>
                      );
                    })()}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {cls.students.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{L.noStudents}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {cls.students.map((s) => (
                      <li
                        key={s.profile_id}
                        className="flex items-center justify-between text-sm rounded-md px-3 py-1.5 bg-gradient-to-r from-muted/80 to-transparent"
                      >
                        <span className="font-medium">
                          {isNative ? (
                            <>
                              {s.english_name ?? s.korean_name ?? "—"}
                              {s.korean_name && (
                                <span className="text-muted-foreground font-normal ml-1">
                                  ({s.korean_name})
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              {s.korean_name ?? "—"}
                              {s.english_name && (
                                <span className="text-muted-foreground font-normal ml-1">
                                  ({s.english_name})
                                </span>
                              )}
                            </>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2 pt-1 border-t">
                  {isNative ? (
                    <>
                      <Link
                        href={`/academy/teacher/reports?class=${cls.id}`}
                        className="text-xs font-medium text-red-600 hover:text-red-800 transition-colors inline-flex items-center gap-1"
                      >
                        Report Cards
                        {arrowIcon}
                      </Link>
                      <Link
                        href={`/academy/teacher/textbooks?class=${cls.id}`}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors ml-auto inline-flex items-center gap-1"
                      >
                        Textbooks
                        {arrowIcon}
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href={`/academy/teacher/textbooks?class=${cls.id}`}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors ml-auto inline-flex items-center gap-1"
                      >
                        교재
                        {arrowIcon}
                      </Link>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import { redirect } from "next/navigation";
import { getCurrentTeacherProfile, getTeacherClasses } from "../../actions";
import { listClassTextbooks } from "@/app/(admin)/admin/actions/class-textbook-actions";
import { listClassUnitProgressDetailed } from "@/app/(admin)/admin/actions/homework-unit-actions";
import { listAcademyClosedDays } from "@/app/(admin)/admin/actions/closed-days-actions";
import { TeacherTextbooksClient } from "./_components/TeacherTextbooksClient";

export default async function TeacherHomeworkPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const profile = await getCurrentTeacherProfile();
  if (!profile) redirect("/academy/login");
  // 모든 교사 (한국·원어민) 가 read-only 진도 확인 가능. 일정 수정 권한은 한국 교사만.
  const canEditSchedule = profile.teacher_type === "korean";

  const classes = await getTeacherClasses();
  if (classes.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-lg font-semibold text-slate-800">숙제</h1>
        <div className="rounded-xl border bg-card py-12 text-center">
          <p className="text-sm text-muted-foreground">담당 반이 없습니다.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            관리자에게 반 배정을 요청하세요.
          </p>
        </div>
      </div>
    );
  }

  const params = await searchParams;
  const selectedClassId =
    params.class && classes.find((c) => c.id === params.class)
      ? params.class
      : classes[0].id;

  const [classTextbooks, initialDetailed, closedDaysResult] = await Promise.all([
    listClassTextbooks(selectedClassId),
    listClassUnitProgressDetailed(selectedClassId),
    listAcademyClosedDays(),
  ]);
  const closedDates = closedDaysResult.days.map((d) => d.closed_date);

  const classesList = classes.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">숙제</h1>
      </div>

      <TeacherTextbooksClient
        classes={classesList}
        selectedClassId={selectedClassId}
        classTextbooks={classTextbooks}
        canEditSchedule={canEditSchedule}
        initialData={initialDetailed}
        closedDates={closedDates}
      />
    </div>
  );
}

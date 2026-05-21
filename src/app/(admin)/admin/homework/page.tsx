import {
  listAllSeries,
  listLevelsBySeries,
  listPublishers,
  listClassesForHomeworkPicker,
  listClassUnitProgressDetailed,
  listClassTextbooks,
  listTextbooks,
  listTeachersForSelect,
  getAbsentStudentIds,
} from "../actions";
import { todayKst } from "@/lib/utils/date-kst";
import { PageHeader } from "@/components/navigation/PageHeader";
import { TextbooksPageClient } from "./_components/TextbooksPageClient";
import { Suspense } from "react";

export default async function AdminTextbooksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; class?: string }>;
}) {
  const params = await searchParams;
  // 레거시 "check" / "series" URL 도 흡수 (series 탭은 제거됨 → 숙제 탭으로 fallback)
  const rawTab = params.tab ?? "textbooks";
  const tab =
    rawTab === "check"
      ? "class"
      : rawTab === "series"
        ? "textbooks"
        : rawTab;

  const [
    allSeriesList,
    levelsBySeries,
    activePublishers,
    classList,
    teachers,
    textbooks,
  ] = await Promise.all([
    listAllSeries(),
    listLevelsBySeries(),
    listPublishers({ activeOnly: true }),
    listClassesForHomeworkPicker(),
    listTeachersForSelect(),
    listTextbooks(),
  ]);

  const classOptions = classList;
  const initialClassId =
    tab === "class"
      ? params.class && classOptions.find((c) => c.id === params.class)
        ? params.class
        : classOptions[0]?.id ?? null
      : null;

  const today = todayKst();

  // 통합 탭일 때만 초기 데이터 미리 로드
  const [initialCheckData, initialAssignments, absentResult] = await Promise.all([
    tab === "class" && initialClassId
      ? listClassUnitProgressDetailed(initialClassId)
      : Promise.resolve({ students: [], byStudent: {} }),
    tab === "class" && initialClassId
      ? listClassTextbooks(initialClassId)
      : Promise.resolve([]),
    getAbsentStudentIds(today),
  ]);

  return (
    <div className="flex flex-1 min-w-0 flex-col p-6 md:p-8">
      <PageHeader
        title="숙제 관리"
        description="시리즈(숙제) 관리 + 반별 부여 / 진도 체크."
      />
      <Suspense>
        <TextbooksPageClient
          allSeriesList={allSeriesList}
          levelsBySeries={levelsBySeries}
          initialPublishers={activePublishers.map((p) => ({
            id: p.id,
            name: p.name,
          }))}
          checkClasses={classOptions}
          checkInitialClassId={initialClassId}
          checkInitialData={initialCheckData}
          classInitialAssignments={initialAssignments}
          classAllTextbooks={textbooks}
          teachers={teachers}
          initialAbsentStudentIds={absentResult.studentIds}
          todayKst={today}
        />
      </Suspense>
    </div>
  );
}

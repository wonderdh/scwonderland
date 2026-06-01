import {
  listClassesForHomeworkPicker,
  listTeachersForSelect,
} from "@/app/(admin)/admin/actions/class-actions";
import {
  listClassTextbooks,
} from "@/app/(admin)/admin/actions/class-textbook-actions";
import {
  listClassUnitProgressDetailed,
  getAbsentStudentIds,
} from "@/app/(admin)/admin/actions/homework-unit-actions";
import {
  listPublishers,
} from "@/app/(admin)/admin/actions/publisher-actions";
import {
  listAllSeries,
  listLevelsBySeries,
} from "@/app/(admin)/admin/actions/series-actions";
import {
  listTextbooks,
} from "@/app/(admin)/admin/actions/textbook-actions";
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
      : Promise.resolve({ students: [], byStudent: {}, meetDays: [] }),
    tab === "class" && initialClassId
      ? listClassTextbooks(initialClassId)
      : Promise.resolve([]),
    getAbsentStudentIds(today),
  ]);

  const boardSeriesOptions = allSeriesList
    .filter((s) => s.is_active)
    .map((s) => ({ id: s.id, name: s.name }));
  const boardLevelsBySeries: Record<string, string[]> = {};
  for (const [sid, rows] of Object.entries(levelsBySeries)) {
    const set = new Set<string>();
    for (const r of rows) if (r.level) set.add(r.level);
    boardLevelsBySeries[sid] = [...set].sort((a, b) =>
      a.localeCompare(b, "ko", { numeric: true })
    );
  }

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
          boardSeriesOptions={boardSeriesOptions}
          boardLevelsBySeries={boardLevelsBySeries}
        />
      </Suspense>
    </div>
  );
}

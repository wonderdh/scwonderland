import {
  listTextbooks,
  listSeries,
  listAllSeries,
  listPublishers,
  listClassesForHomeworkPicker,
  listClassUnitProgressDetailed,
  listClassTextbooks,
} from "../actions";
import { PageHeader } from "@/components/navigation/PageHeader";
import { TextbooksPageClient } from "./_components/TextbooksPageClient";
import { Suspense } from "react";

export default async function AdminTextbooksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; class?: string }>;
}) {
  const params = await searchParams;
  // 레거시 "check" URL 도 새 "class" 탭으로 흡수
  const rawTab = params.tab ?? "textbooks";
  const tab = rawTab === "check" ? "class" : rawTab;

  const [textbooks, activeSeriesList, allSeriesList, activePublishers, classList] =
    await Promise.all([
      listTextbooks(),
      listSeries({ activeOnly: true }),
      listAllSeries(),
      listPublishers({ activeOnly: true }),
      listClassesForHomeworkPicker(),
    ]);

  const classOptions = classList;
  const initialClassId =
    tab === "class"
      ? params.class && classOptions.find((c) => c.id === params.class)
        ? params.class
        : classOptions[0]?.id ?? null
      : null;

  // 통합 탭일 때만 초기 데이터 미리 로드
  const initialCheckData =
    tab === "class" && initialClassId
      ? await listClassUnitProgressDetailed(initialClassId)
      : { students: [], byStudent: {} };
  const initialAssignments =
    tab === "class" && initialClassId
      ? await listClassTextbooks(initialClassId)
      : [];

  return (
    <div className="flex flex-1 min-w-0 flex-col p-6 md:p-8">
      <PageHeader
        title="숙제 관리"
        description="반/개인 부여, 시리즈 관리, 학생별 진도 체크."
      />
      <Suspense>
        <TextbooksPageClient
          initialTextbooks={textbooks}
          activeSeriesList={activeSeriesList}
          allSeriesList={allSeriesList}
          initialPublishers={activePublishers.map((p) => ({
            id: p.id,
            name: p.name,
          }))}
          checkClasses={classOptions}
          checkInitialClassId={initialClassId}
          checkInitialData={initialCheckData}
          classInitialAssignments={initialAssignments}
          classAllTextbooks={textbooks}
        />
      </Suspense>
    </div>
  );
}

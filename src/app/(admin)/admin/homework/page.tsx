import {
  listTextbooks,
  listSeries,
  listAllSeries,
  listPublishers,
  listClassesWithDetails,
  listClassUnitProgressDetailed,
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
  const tab = params.tab ?? "textbooks";

  const [textbooks, activeSeriesList, allSeriesList, activePublishers, classList] =
    await Promise.all([
      listTextbooks(),
      listSeries({ activeOnly: true }),
      listAllSeries(),
      listPublishers({ activeOnly: true }),
      listClassesWithDetails(),
    ]);

  const classOptions = classList.map((c) => ({ id: c.id, name: c.name }));
  const initialClassId =
    tab === "check"
      ? params.class && classOptions.find((c) => c.id === params.class)
        ? params.class
        : classOptions[0]?.id ?? null
      : null;

  // 체크 탭일 때만 초기 데이터 미리 로드 (다른 탭 진입 시 비용 절감)
  const initialCheckData =
    tab === "check" && initialClassId
      ? await listClassUnitProgressDetailed(initialClassId)
      : { students: [], byStudent: {} };

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
        />
      </Suspense>
    </div>
  );
}

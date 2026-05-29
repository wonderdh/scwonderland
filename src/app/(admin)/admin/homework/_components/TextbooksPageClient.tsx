"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SeriesCardsManager } from "./SeriesCardsManager";
import { ClassHomeworkManageTab } from "./ClassHomeworkManageTab";
import { HomeworkBoard } from "@/components/homework/HomeworkBoard";
import type {
  BoardSeriesOption,
  BoardLevelsBySeries,
} from "@/components/homework/HomeworkBoard";
import type {
  TextbookWithSeries,
  SeriesWithPublisher,
  SeriesLevelRow,
  ClassUnitProgressDetailed,
  ClassTextbookWithDetails,
  HomeworkClassPickerOption,
} from "../../actions";
import type { TeacherOption } from "@/lib/types";

type PublisherOption = { id: string; name: string };
type ClassOption = HomeworkClassPickerOption;

type TabId = "board" | "textbooks" | "class";

const TABS: { id: TabId; label: string }[] = [
  { id: "board", label: "시리즈·레벨" },
  { id: "textbooks", label: "숙제" },
  { id: "class", label: "반 숙제 관리" },
];

function parseTab(tab: string | null | undefined): TabId {
  // 레거시 "check" / "series" URL 호환
  if (tab === "class" || tab === "check") return "class";
  if (tab === "textbooks" || tab === "series") return "textbooks";
  return "board";
}

export function TextbooksPageClient({
  allSeriesList,
  levelsBySeries,
  initialPublishers,
  checkClasses,
  checkInitialClassId,
  checkInitialData,
  classInitialAssignments,
  classAllTextbooks,
  teachers,
  initialAbsentStudentIds,
  todayKst,
  boardSeriesOptions,
  boardLevelsBySeries,
}: {
  allSeriesList: SeriesWithPublisher[];
  levelsBySeries: Record<string, SeriesLevelRow[]>;
  initialPublishers?: PublisherOption[];
  checkClasses: ClassOption[];
  checkInitialClassId: string | null;
  checkInitialData: ClassUnitProgressDetailed;
  classInitialAssignments: ClassTextbookWithDetails[];
  classAllTextbooks: TextbookWithSeries[];
  teachers: TeacherOption[];
  initialAbsentStudentIds: string[];
  todayKst: string;
  boardSeriesOptions: BoardSeriesOption[];
  boardLevelsBySeries: BoardLevelsBySeries;
}) {
  const searchParams = useSearchParams();
  const currentTab = parseTab(searchParams.get("tab"));

  return (
    <>
      {/* Tab nav */}
      <nav className="flex border-b bg-card rounded-t-xl overflow-x-auto mb-6">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={
              t.id === "board"
                ? "/admin/homework"
                : `/admin/homework?tab=${t.id}`
            }
            className={`h-12 px-5 inline-flex items-center text-base font-medium transition-colors whitespace-nowrap border-b-[3px] ${
              currentTab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {/* Tab content */}
      {currentTab === "board" ? (
        <HomeworkBoard
          seriesOptions={boardSeriesOptions}
          levelsBySeries={boardLevelsBySeries}
          todayKst={todayKst}
        />
      ) : currentTab === "textbooks" ? (
        <SeriesCardsManager
          initialSeries={allSeriesList}
          initialLevelsBySeries={levelsBySeries}
          initialPublishers={initialPublishers}
        />
      ) : (
        <ClassHomeworkManageTab
          classes={checkClasses}
          initialClassId={checkInitialClassId}
          initialProgress={checkInitialData}
          initialAssignments={classInitialAssignments}
          allTextbooks={classAllTextbooks}
          teachers={teachers}
          initialAbsentStudentIds={initialAbsentStudentIds}
          todayKstProp={todayKst}
        />
      )}
    </>
  );
}

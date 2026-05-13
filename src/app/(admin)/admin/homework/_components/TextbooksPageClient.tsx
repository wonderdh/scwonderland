"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TextbooksManager } from "./TextbooksManager";
import { SeriesManager } from "./SeriesManager";
import { ClassHomeworkManageTab } from "./ClassHomeworkManageTab";
import type {
  TextbookWithSeries,
  SeriesWithPublisher,
  ClassUnitProgressDetailed,
  ClassTextbookWithDetails,
  HomeworkClassPickerOption,
} from "../../actions";
import type { TeacherOption } from "@/lib/types";
import type { Database } from "@/lib/types/database.generated";

type PublisherOption = { id: string; name: string };
type ClassOption = HomeworkClassPickerOption;
type TextbookRow = Database["public"]["Tables"]["homework_books"]["Row"];

type TabId = "textbooks" | "series" | "class";

const TABS: { id: TabId; label: string }[] = [
  { id: "textbooks", label: "숙제" },
  { id: "series", label: "시리즈" },
  { id: "class", label: "반 숙제 관리" },
];

function parseTab(tab: string | null | undefined): TabId {
  if (tab === "series") return "series";
  // 레거시 "check" URL 호환
  if (tab === "class" || tab === "check") return "class";
  return "textbooks";
}

export function TextbooksPageClient({
  initialTextbooks,
  activeSeriesList,
  allSeriesList,
  initialPublishers,
  checkClasses,
  checkInitialClassId,
  checkInitialData,
  classInitialAssignments,
  classAllTextbooks,
  teachers,
}: {
  initialTextbooks: TextbookWithSeries[];
  activeSeriesList: SeriesWithPublisher[];
  allSeriesList: SeriesWithPublisher[];
  initialPublishers?: PublisherOption[];
  checkClasses: ClassOption[];
  checkInitialClassId: string | null;
  checkInitialData: ClassUnitProgressDetailed;
  classInitialAssignments: ClassTextbookWithDetails[];
  classAllTextbooks: TextbookRow[];
  teachers: TeacherOption[];
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
              t.id === "textbooks"
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
      {currentTab === "textbooks" ? (
        <TextbooksManager
          initialTextbooks={initialTextbooks}
          seriesList={activeSeriesList}
        />
      ) : currentTab === "series" ? (
        <SeriesManager
          initialSeries={allSeriesList}
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
        />
      )}
    </>
  );
}

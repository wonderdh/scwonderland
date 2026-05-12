"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TextbooksManager } from "./TextbooksManager";
import { SeriesManager } from "./SeriesManager";
import { HomeworkCheckTab } from "./HomeworkCheckTab";
import type {
  TextbookWithSeries,
  SeriesWithPublisher,
  ClassUnitProgressDetailed,
  HomeworkClassPickerOption,
} from "../../actions";

type PublisherOption = { id: string; name: string };
type ClassOption = HomeworkClassPickerOption;

type TabId = "textbooks" | "series" | "check";

const TABS: { id: TabId; label: string }[] = [
  { id: "textbooks", label: "숙제" },
  { id: "series", label: "시리즈" },
  { id: "check", label: "반별 체크" },
];

function parseTab(tab: string | null | undefined): TabId {
  if (tab === "series") return "series";
  if (tab === "check") return "check";
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
}: {
  initialTextbooks: TextbookWithSeries[];
  activeSeriesList: SeriesWithPublisher[];
  allSeriesList: SeriesWithPublisher[];
  initialPublishers?: PublisherOption[];
  checkClasses: ClassOption[];
  checkInitialClassId: string | null;
  checkInitialData: ClassUnitProgressDetailed;
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
        <HomeworkCheckTab
          classes={checkClasses}
          initialClassId={checkInitialClassId}
          initialData={checkInitialData}
        />
      )}
    </>
  );
}

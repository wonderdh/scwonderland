import Link from "next/link";
import {
  listClassesForHomeworkPicker,
  listClassUnitProgressDetailed,
  listTeachersForSelect,
} from "@/app/(admin)/admin/actions";
import { MobileHomeworkClient } from "./_components/MobileHomeworkClient";

export default async function MobileHomeworkPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const [classOptions, teachers] = await Promise.all([
    listClassesForHomeworkPicker(),
    listTeachersForSelect(),
  ]);
  const params = await searchParams;
  const initialClassId =
    params.class && classOptions.find((c) => c.id === params.class)
      ? params.class
      : classOptions[0]?.id ?? null;

  const initialData = initialClassId
    ? await listClassUnitProgressDetailed(initialClassId)
    : { students: [], byStudent: {} };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <Link
          href="/m"
          className="rounded-md p-1.5 hover:bg-muted -ml-1 text-muted-foreground"
          aria-label="뒤로"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5 8.25 12l7.5-7.5"
            />
          </svg>
        </Link>
        <h1 className="text-base font-semibold text-foreground">숙제 관리</h1>
      </header>
      <div className="flex-1 px-3 py-3">
        <MobileHomeworkClient
          classes={classOptions}
          initialClassId={initialClassId}
          initialData={initialData}
          teachers={teachers}
        />
      </div>
    </div>
  );
}

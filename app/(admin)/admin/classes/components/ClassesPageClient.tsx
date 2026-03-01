"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ClassWithDetails, AcademyPeriod } from "@/lib/types";
import { ClassesManager } from "./ClassesManager";
import { ClassesOverview } from "./ClassesOverview";
import { ClassScheduleManager } from "./ClassScheduleManager";

type TabId = "overview" | "manage" | "schedule";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "전체 반" },
  { id: "manage", label: "반 관리" },
  { id: "schedule", label: "수업 배정" },
];

function parseTab(tab: string | undefined): TabId {
  if (tab && (["overview", "manage", "schedule"] as string[]).includes(tab))
    return tab as TabId;
  return "overview";
}

type TeacherOption = {
  id: string;
  name: string;
  teacher_type: "korean" | "native";
};

type StudentInfo = {
  id: string;
  korean_name: string | null;
  english_name: string | null;
  student_number: string | null;
};

type FlatClassStudent = {
  class_id: string;
  id: string;
  student_profile_id: string;
  korean_name: string | null;
  english_name: string | null;
  student_number: string | null;
};

export function ClassesPageClient({
  initialClasses,
  teachers,
  allClassStudents,
  allStudents,
  periods,
}: {
  initialClasses: ClassWithDetails[];
  teachers: TeacherOption[];
  allClassStudents: FlatClassStudent[];
  allStudents: StudentInfo[];
  periods: AcademyPeriod[];
}) {
  const searchParams = useSearchParams();
  const currentTab = parseTab(searchParams.get("tab") ?? undefined);

  return (
    <>
      <h1 className="text-xl font-bold text-slate-800 mb-4">반 관리</h1>

      {/* 탭 네비 */}
      <nav className="flex border-b bg-card rounded-t-xl overflow-x-auto mb-0">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={
              t.id === "overview"
                ? "/admin/classes"
                : `/admin/classes?tab=${t.id}`
            }
            className={`px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
              currentTab === t.id
                ? "text-foreground border-b-2 border-primary bg-muted/50"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {/* 탭 콘텐츠 */}
      <div className="rounded-b-xl border border-t-0 border-slate-200 bg-white p-6">
        {currentTab === "overview" && (
          <ClassesOverview
            classes={initialClasses}
            allClassStudents={allClassStudents}
          />
        )}
        {currentTab === "manage" && (
          <ClassesManager
            initialClasses={initialClasses}
            teachers={teachers}
            allClassStudents={allClassStudents}
            allStudents={allStudents}
          />
        )}
        {currentTab === "schedule" && (
          <ClassScheduleManager
            classes={initialClasses}
            teachers={teachers}
            periods={periods}
          />
        )}
      </div>
    </>
  );
}

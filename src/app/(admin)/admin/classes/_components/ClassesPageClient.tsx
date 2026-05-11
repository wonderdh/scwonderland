"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ClassWithDetails, AcademyPeriod } from "@/lib/types";
import { ClassesManager } from "./ClassesManager";
import { ClassesOverview } from "./ClassesOverview";
import { ClassScheduleManager } from "./ClassScheduleManager";
import { ClassTextbookView } from "./ClassTextbookView";
import { PageHeader } from "@/components/navigation/PageHeader";

type TabId = "overview" | "manage" | "schedule" | "homework";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "전체 반" },
  { id: "manage", label: "반 관리" },
  { id: "schedule", label: "수업 배정" },
  { id: "homework", label: "숙제" },
];

function parseTab(tab: string | undefined): TabId {
  if (tab && (["overview", "manage", "schedule", "homework"] as string[]).includes(tab))
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
  age: number | null;
  group_type: string | null;
};

type FlatClassStudent = {
  class_id: string;
  id: string;
  student_profile_id: string;
  korean_name: string | null;
  english_name: string | null;
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
      <PageHeader title="반 관리" description="반을 관리하고 담당 선생님·학생·숙제를 배정합니다." />

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
            className={`h-12 px-5 inline-flex items-center text-base font-medium transition-colors whitespace-nowrap border-b-[3px] ${
              currentTab === t.id
                ? "bg-orange-50 text-orange-700 border-orange-500"
                : "text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-50"
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
            teachers={teachers}
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
        {currentTab === "homework" && (
          <ClassTextbookView classes={initialClasses} />
        )}
      </div>
    </>
  );
}

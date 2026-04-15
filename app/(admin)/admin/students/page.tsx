import {
  deleteUserById,
  listUsersByRole,
  listDeletedUsers,
  restoreUser,
  permanentlyDeleteUser,
  updateStudentProfile,
  getStudentClasses,
} from "../actions";
import { AdminListSidebar } from "../components/AdminListSidebar";
import { ScrollToSection } from "../components/ScrollToSection";
import { PageHeader } from "@/components/navigation/PageHeader";
import { AddStudentForm } from "./components/AddStudentForm";
import { StudentGroupedList } from "./components/StudentGroupedList";
import { StudentInfoCard } from "./components/StudentSelectedView";
import { StudentTabNav, type StudentTabId } from "./components/StudentTabNav";
import { StudentClassesView } from "./components/StudentClassesView";
import { StudentLearningTab } from "./components/StudentLearningTab";
import { StudentReportTab } from "./components/StudentReportTab";
import { StudentTextbookTab } from "./components/StudentTextbookTab";
import { StudentAttendanceTab } from "./components/StudentAttendanceTab";
import { StudentBusTab } from "./components/StudentBusTab";
import { StudentTimetableTab } from "./components/StudentTimetableTab";
import { TrashView } from "../components/TrashView";
import { BulkPasswordResetDialog } from "./components/BulkPasswordResetDialog";

const VALID_TABS: StudentTabId[] = ["basic", "learning", "schedule", "bus"];

function parseTab(tab: string | undefined): StudentTabId {
  if (tab && VALID_TABS.includes(tab as StudentTabId)) return tab as StudentTabId;
  // Backwards compat: map legacy tab ids to new ones
  if (tab === "info") return "basic";
  if (tab === "report" || tab === "textbook") return "learning";
  if (tab === "timetable" || tab === "attendance") return "schedule";
  return "basic";
}

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; selected?: string; tab?: string }>;
}) {
  const { section, selected, tab } = await searchParams;
  const currentTab = parseTab(tab);

  const [users, studentClassesResult, deletedUsers] = await Promise.all([
    listUsersByRole("student"),
    selected && currentTab === "basic" ? getStudentClasses(selected) : Promise.resolve({ classes: [] as Awaited<ReturnType<typeof getStudentClasses>>["classes"], error: undefined }),
    section === "trash" ? listDeletedUsers("student") : Promise.resolve([]),
  ]);

  const selectedUser = selected ? users.find((u) => u.id === selected) : null;

  return (
    <div className="flex flex-1 min-w-0 -m-6 md:-m-8">
      <AdminListSidebar users={users} variant="students" />
      <div className="flex-1 min-w-0 p-6 md:p-8 flex flex-col">
        {section === "trash" ? (
          <>
            <PageHeader title="학생 관리" description="휴지통 — 삭제된 학생을 복구하거나 영구 삭제합니다." />
            <TrashView
              users={deletedUsers}
              variant="student"
              onRestore={restoreUser}
              onPermanentDelete={permanentlyDeleteUser}
            />
          </>
        ) : section === "add" || !selectedUser ? (
          <>
            <PageHeader title="학생 관리" description="학생을 추가하고 기본 정보를 관리합니다." />
            {section === "add" && <ScrollToSection section="add" />}
            <section id="add" className="mb-8">
              <h2 className="text-xl font-semibold text-slate-800 mb-3">학생 추가</h2>
              <AddStudentForm />
            </section>
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold text-slate-800">
                  학생 목록
                  <span className="ml-2 text-base font-normal text-slate-500">{users.length}명</span>
                </h2>
                <BulkPasswordResetDialog users={users} />
              </div>
              <StudentGroupedList users={users} onUpdate={updateStudentProfile} onDelete={deleteUserById} />
            </section>
          </>
        ) : selectedUser ? (
          <>
            <StudentTabNav selectedId={selectedUser.id} currentTab={currentTab} />
            <div className="rounded-b-xl border border-t-0 border-slate-200 bg-white p-6 flex-1">
              {currentTab === "basic" && (
                <div className="space-y-8">
                  <StudentInfoCard user={selectedUser} onUpdate={updateStudentProfile} onDelete={deleteUserById} />
                  <StudentClassesView classes={studentClassesResult.classes} error={studentClassesResult.error} />
                </div>
              )}
              {currentTab === "learning" && (
                <div className="space-y-10">
                  <section>
                    <h2 className="text-xl font-semibold text-slate-900 mt-2 mb-4 pb-2 border-b border-slate-200">학습관리</h2>
                    <StudentLearningTab studentProfileId={selectedUser.id} />
                  </section>
                  <section>
                    <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4 pb-2 border-b border-slate-200">리포트카드</h2>
                    <StudentReportTab studentProfileId={selectedUser.id} />
                  </section>
                  <section>
                    <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4 pb-2 border-b border-slate-200">교재</h2>
                    <StudentTextbookTab studentProfileId={selectedUser.id} />
                  </section>
                </div>
              )}
              {currentTab === "schedule" && (
                <div className="space-y-10">
                  <section>
                    <h2 className="text-xl font-semibold text-slate-900 mt-2 mb-4 pb-2 border-b border-slate-200">시간표</h2>
                    <StudentTimetableTab
                      studentProfileId={selectedUser.id}
                      studentName={selectedUser.korean_name ?? selectedUser.first_name ?? ""}
                    />
                  </section>
                  <section>
                    <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4 pb-2 border-b border-slate-200">출결</h2>
                    <StudentAttendanceTab studentProfileId={selectedUser.id} />
                  </section>
                </div>
              )}
              {currentTab === "bus" && <StudentBusTab studentProfileId={selectedUser.id} />}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

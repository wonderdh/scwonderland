import {
  deleteUserById,
  listUsersByRole,
  listDeletedUsers,
  restoreUser,
  permanentlyDeleteUser,
  updateStudentProfile,
} from "../actions";
import { AdminListSidebar } from "../components/AdminListSidebar";
import { ScrollToSection } from "../components/ScrollToSection";
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

const VALID_TABS: StudentTabId[] = ["info", "learning", "report", "textbook", "timetable", "attendance", "bus"];

function parseTab(tab: string | undefined): StudentTabId {
  if (tab && VALID_TABS.includes(tab as StudentTabId)) return tab as StudentTabId;
  return "info";
}

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; selected?: string; tab?: string }>;
}) {
  const { section, selected, tab } = await searchParams;
  const users = await listUsersByRole("student");
  const selectedUser = selected ? users.find((u) => u.id === selected) : null;
  const currentTab = parseTab(tab);
  const deletedUsers = section === "trash" ? await listDeletedUsers("student") : [];

  return (
    <div className="flex flex-1 min-w-0 -m-6 md:-m-8">
      <AdminListSidebar users={users} variant="students" />
      <div className="flex-1 min-w-0 p-6 md:p-8 flex flex-col">
        {section === "trash" ? (
          <TrashView
            users={deletedUsers}
            variant="student"
            onRestore={restoreUser}
            onPermanentDelete={permanentlyDeleteUser}
          />
        ) : section === "add" || !selectedUser ? (
          <>
            {section === "add" && <ScrollToSection section="add" />}
            <section id="add" className="mb-8">
              <h2 className="text-base font-semibold text-slate-800 mb-3">학생 추가</h2>
              <AddStudentForm />
            </section>
            <section>
              <h2 className="text-base font-semibold text-slate-800 mb-3">
                학생 목록
                <span className="ml-2 text-sm font-normal text-slate-400">{users.length}명</span>
              </h2>
              <StudentGroupedList users={users} onUpdate={updateStudentProfile} onDelete={deleteUserById} />
            </section>
          </>
        ) : selectedUser ? (
          <>
            <StudentTabNav selectedId={selectedUser.id} currentTab={currentTab} />
            <div className="rounded-b-xl border border-t-0 border-slate-200 bg-white p-6 flex-1">
              {currentTab === "info" && (
                <div className="space-y-8">
                  <StudentInfoCard user={selectedUser} onUpdate={updateStudentProfile} onDelete={deleteUserById} />
                  <StudentClassesView studentProfileId={selectedUser.id} />
                </div>
              )}
              {currentTab === "learning" && <StudentLearningTab studentProfileId={selectedUser.id} />}
              {currentTab === "report" && selectedUser && (
                <StudentReportTab studentProfileId={selectedUser.id} />
              )}
              {currentTab === "textbook" && selectedUser && (
                <StudentTextbookTab studentProfileId={selectedUser.id} />
              )}
              {currentTab === "timetable" && <StudentTimetableTab studentProfileId={selectedUser.id} studentName={selectedUser.korean_name ?? selectedUser.first_name ?? ""} />}
              {currentTab === "attendance" && <StudentAttendanceTab studentProfileId={selectedUser.id} />}
              {currentTab === "bus" && <StudentBusTab studentProfileId={selectedUser.id} />}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

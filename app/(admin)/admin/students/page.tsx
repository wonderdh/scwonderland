import {
  deleteUserById,
  listUsersByRole,
  updateStudentProfile,
} from "../actions";
import { AdminListSidebar } from "../components/AdminListSidebar";
import { ScrollToSection } from "../components/ScrollToSection";
import { UserList } from "../components/UserList";
import { AddStudentForm } from "./components/AddStudentForm";
import { StudentInfoCard } from "./components/StudentSelectedView";
import { StudentTabNav, type StudentTabId } from "./components/StudentTabNav";
import { StudentClassesView } from "./components/StudentClassesView";
import { StudentLearningTab } from "./components/StudentLearningTab";
import { StudentReportTab } from "./components/StudentReportTab";
import { StudentTextbookTab } from "./components/StudentTextbookTab";
import { StudentAttendanceTab } from "./components/StudentAttendanceTab";

const VALID_TABS: StudentTabId[] = ["info", "learning", "report", "textbook", "attendance"];

function parseTab(tab: string | undefined): StudentTabId {
  if (tab && VALID_TABS.includes(tab as StudentTabId)) return tab as StudentTabId;
  return "info";
}

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; selected?: string; tab?: string }>;
}) {
  const users = await listUsersByRole("student");
  const { section, selected, tab } = await searchParams;
  const selectedUser = selected ? users.find((u) => u.id === selected) : null;
  const currentTab = parseTab(tab);

  return (
    <div className="flex flex-1 min-w-0 -m-6 md:-m-8">
      <AdminListSidebar users={users} variant="students" />
      <div className="flex-1 min-w-0 p-6 md:p-8 flex flex-col">
        {section === "add" ? (
          <>
            <ScrollToSection section="add" />
            <section id="add" className="mb-8">
              <AddStudentForm />
            </section>
            <section>
              <h2 className="text-lg font-medium text-slate-700 mb-3">학생 목록</h2>
              <UserList
                users={users}
                roleLabel="학생"
                variant="student"
                onUpdate={updateStudentProfile}
                onDelete={deleteUserById}
              />
            </section>
          </>
        ) : selectedUser ? (
          <>
            <StudentTabNav selectedId={selectedUser.id} currentTab={currentTab} />
            <div className="rounded-b-xl border border-t-0 border-slate-200 bg-white p-6 flex-1">
              {currentTab === "info" && (
                <div className="space-y-8">
                  <StudentInfoCard user={selectedUser} onUpdate={updateStudentProfile} />
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
              {currentTab === "attendance" && <StudentAttendanceTab studentProfileId={selectedUser.id} />}
            </div>
          </>
        ) : (
          <div className="py-12 rounded-xl border border-slate-200 border-dashed bg-slate-50/50 flex items-center justify-center flex-1">
            <p className="text-slate-400 text-sm">왼쪽 목록에서 학생을 선택하세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}

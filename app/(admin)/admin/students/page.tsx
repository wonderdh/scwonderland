import {
  deleteUserById,
  listUsersByRole,
  updateStudentProfile,
} from "../actions";
import { AddStudentForm } from "../components/AddStudentForm";
import { AdminListSidebar } from "../components/AdminListSidebar";
import { ScrollToSection } from "../components/ScrollToSection";
import { StudentSelectedView } from "../components/StudentSelectedView";
import { UserList } from "../components/UserList";

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; selected?: string }>;
}) {
  const users = await listUsersByRole("student");
  const { section, selected } = await searchParams;
  const selectedUser = selected ? users.find((u) => u.id === selected) : null;

  return (
    <div className="flex flex-1 min-w-0 -m-6 md:-m-8">
      <AdminListSidebar users={users} variant="students" />
      <div className="flex-1 min-w-0 p-6 md:p-8">
        <h1 className="text-2xl font-semibold text-slate-800 mb-6">학생 관리</h1>

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
          <StudentSelectedView user={selectedUser} onUpdate={updateStudentProfile} />
        ) : (
          <div className="py-12 rounded-xl border border-slate-200 border-dashed bg-slate-50/50 flex items-center justify-center">
            <p className="text-slate-400 text-sm">왼쪽 목록에서 학생을 선택하세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}

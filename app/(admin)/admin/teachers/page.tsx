import {
  deleteUserById,
  listUsersByRole,
  updateTeacherProfile,
} from "../actions";
import { AddTeacherForm } from "../components/AddTeacherForm";
import { AdminListSidebar } from "../components/AdminListSidebar";
import { ScrollToSection } from "../components/ScrollToSection";
import { TeacherDetailCard } from "../components/TeacherDetailCard";
import { UserList } from "../components/UserList";
import Link from "next/link";

export default async function AdminTeachersPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; selected?: string }>;
}) {
  const users = await listUsersByRole("teacher");
  const { section, selected } = await searchParams;
  const selectedUser = selected ? users.find((u) => u.id === selected) : null;

  return (
    <div className="flex flex-1 min-w-0 -m-6 md:-m-8">
      <AdminListSidebar users={users} variant="teachers" />
      <div className="flex-1 min-w-0 p-6 md:p-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-semibold text-slate-800">선생 관리</h1>
          <Link
            href="/admin/teachers?section=add"
            className="shrink-0 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700"
          >
            선생 추가
          </Link>
        </div>

        {section === "add" ? (
          <>
            <ScrollToSection section="add" />
            <section id="add" className="mb-8">
              <AddTeacherForm />
            </section>
            <section>
              <h2 className="text-lg font-medium text-slate-700 mb-3">선생 목록</h2>
              <UserList
                users={users}
                roleLabel="선생"
                variant="teacher"
                onUpdate={updateTeacherProfile}
                onDelete={deleteUserById}
              />
            </section>
          </>
        ) : selectedUser ? (
          <TeacherDetailCard user={selectedUser} />
        ) : (
          <div className="py-12 rounded-xl border border-slate-200 border-dashed bg-slate-50/50 flex items-center justify-center">
            <p className="text-slate-400 text-sm">왼쪽 목록에서 선생을 선택하세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}

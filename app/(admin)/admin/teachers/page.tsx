import {
  deleteUserById,
  listUsersByRole,
  updateTeacherProfile,
} from "../actions";
import { AddTeacherForm } from "../components/AddTeacherForm";
import { ScrollToSection } from "../components/ScrollToSection";
import { UserList } from "../components/UserList";

export default async function AdminTeachersPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const users = await listUsersByRole("teacher");
  const { section } = await searchParams;

  return (
    <div className="max-w-4xl mx-auto">
      <ScrollToSection section={section ?? null} />
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">
        선생 관리
      </h1>

      <section id="add" className="mb-8 scroll-mt-6">
        <h2 className="text-lg font-medium text-slate-700 mb-3">선생 추가</h2>
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
    </div>
  );
}

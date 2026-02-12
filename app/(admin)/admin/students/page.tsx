import {
  deleteUserById,
  listUsersByRole,
  updateStudentProfile,
} from "../actions";
import { AddStudentForm } from "../components/AddStudentForm";
import { ScrollToSection } from "../components/ScrollToSection";
import { UserList } from "../components/UserList";

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const users = await listUsersByRole("student");
  const { section } = await searchParams;

  return (
    <div className="max-w-4xl mx-auto">
      <ScrollToSection section={section ?? null} />
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">
        학생 관리
      </h1>

      <section id="add" className="mb-8 scroll-mt-6">
        <h2 className="text-lg font-medium text-slate-700 mb-3">학생 추가</h2>
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
    </div>
  );
}

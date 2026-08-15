import { redirect, notFound } from "next/navigation";
import {
  getCurrentTeacherProfile,
  getReadLogs,
  getStudentNameForStaff,
  toggleRazRead,
} from "../../../actions";
import { getRazBooks } from "@/lib/raz/books.server";
import { BookGrid } from "@/components/reading/BookGrid";

export default async function TeacherReadingStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const profile = await getCurrentTeacherProfile();
  if (!profile) redirect("/dashboard");

  const [student, books, readLogs] = await Promise.all([
    getStudentNameForStaff(studentId),
    getRazBooks(),
    getReadLogs(studentId),
  ]);
  if (!student) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">
        Raz 리딩 — {student.korean_name ?? student.english_name ?? "학생"}
      </h1>
      <BookGrid
        books={books}
        readLogs={readLogs}
        toggleAction={toggleRazRead.bind(null, studentId)}
      />
    </div>
  );
}

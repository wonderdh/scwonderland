import { notFound } from "next/navigation";
import {
  getReadLogsAsAdmin,
  getStudentNameAsAdmin,
  toggleRazReadAsAdmin,
} from "../../actions/raz-actions";
import { getRazBooks } from "@/lib/raz/books.server";
import { BookGrid } from "@/components/reading/BookGrid";

export default async function AdminReadingStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;

  const [student, books, readLogs] = await Promise.all([
    getStudentNameAsAdmin(studentId),
    getRazBooks(),
    getReadLogsAsAdmin(studentId),
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
        toggleAction={toggleRazReadAsAdmin.bind(null, studentId)}
      />
    </div>
  );
}

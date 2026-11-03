import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getReadLogsAsAdmin,
  getStudentNameAsAdmin,
  toggleRazReadAsAdmin,
} from "../../../admin/actions/raz-actions";
import { getRazBooks } from "@/lib/raz/books.server";
import { BookGrid } from "@/components/reading/BookGrid";
import { ChevronLeft } from "lucide-react";

export default async function MobileReadingStudentPage({
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
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background px-4 py-3">
        <Link href="/m/reading" className="text-muted-foreground">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-semibold text-foreground">
          리딩 — {student.korean_name ?? student.english_name ?? "학생"}
        </h1>
      </header>

      <div className="flex-1 px-4 py-4">
        <BookGrid
          books={books}
          readLogs={readLogs}
          toggleAction={toggleRazReadAsAdmin.bind(null, studentId)}
        />
      </div>
    </div>
  );
}

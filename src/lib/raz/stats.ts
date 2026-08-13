// 순수 집계 함수 — 서버·클라 무관, DB 접근 없음.
import type { RazBook } from "@/lib/types";

export interface ReadingStudentStat {
  studentId: string;
  koreanName: string | null;
  englishName: string | null;
  readCount: number;
  topLevel: string | null; // 읽은 책 중 가장 높은 레벨
  levelCounts: Record<string, number>; // 레벨별 읽은 권수
}

export interface ClassReadingStats {
  classId: string;
  className: string;
  students: ReadingStudentStat[];
}

export interface ClassWithStudents {
  id: string;
  name: string;
  students: { id: string; koreanName: string | null; englishName: string | null }[];
}

export function aggregateReadingStats(
  classes: ClassWithStudents[],
  logs: { student_id: string; book_id: number }[],
  books: Pick<RazBook, "id" | "level" | "level_order">[],
): ClassReadingStats[] {
  const bookById = new Map(books.map((b) => [b.id, b]));
  const logsByStudent = new Map<string, number[]>();
  for (const log of logs) {
    const arr = logsByStudent.get(log.student_id);
    if (arr) arr.push(log.book_id);
    else logsByStudent.set(log.student_id, [log.book_id]);
  }
  return classes.map((c) => ({
    classId: c.id,
    className: c.name,
    students: c.students.map((s) => {
      const levelCounts: Record<string, number> = {};
      let readCount = 0;
      let top: { level: string; order: number } | null = null;
      for (const bookId of logsByStudent.get(s.id) ?? []) {
        const book = bookById.get(bookId);
        if (!book) continue; // 카탈로그에 없는 id 는 스킵
        readCount++;
        levelCounts[book.level] = (levelCounts[book.level] ?? 0) + 1;
        if (!top || book.level_order > top.order) top = { level: book.level, order: book.level_order };
      }
      return {
        studentId: s.id,
        koreanName: s.koreanName,
        englishName: s.englishName,
        readCount,
        topLevel: top?.level ?? null,
        levelCounts,
      };
    }),
  }));
}

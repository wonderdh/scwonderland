import type { Database } from "@/lib/types/database.generated";

export type RazBook = Database["public"]["Tables"]["raz_books"]["Row"];

/** 학생 한 명의 읽음 기록 1건 (raz_read_logs 행의 화면용 축약) */
export interface RazReadLogEntry {
  bookId: number;
  readAt: string; // ISO timestamptz
}

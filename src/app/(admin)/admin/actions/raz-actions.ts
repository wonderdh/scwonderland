"use server";

import { revalidatePath } from "next/cache";
import { verifyAdmin } from "./auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getRazBooks } from "@/lib/raz/books.server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { aggregateReadingStats, type ClassReadingStats } from "@/lib/raz/stats";

/** 전체 활성 반의 학생별 읽기 통계 */
export async function getAllReadingStats(): Promise<ClassReadingStats[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];

  const admin = createAdminClient();
  const { data: classes } = await admin
    .from("classes")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  if (!classes?.length) return [];

  const { data: members } = await admin
    .from("class_students")
    .select("class_id, student_id")
    .eq("is_active", true)
    .in("class_id", classes.map((c) => c.id));

  const studentIds = [...new Set((members ?? []).map((m) => m.student_id))];
  const { data: students } = studentIds.length
    ? await admin.from("students").select("id, korean_name, english_name").in("id", studentIds)
    : { data: [] };
  const studentMap = new Map((students ?? []).map((s) => [s.id, s]));

  const logs = studentIds.length
    ? await fetchAllRows<{ student_id: string; book_id: number }>((from, to) =>
        admin.from("raz_read_logs").select("student_id, book_id").in("student_id", studentIds).range(from, to),
      )
    : [];
  const books = await getRazBooks();

  const classShapes = classes.map((c) => ({
    id: c.id,
    name: c.name,
    students: (members ?? [])
      .filter((m) => m.class_id === c.id)
      .map((m) => {
        const s = studentMap.get(m.student_id);
        return {
          id: m.student_id,
          koreanName: s?.korean_name ?? null,
          englishName: s?.english_name ?? null,
        };
      }),
  }));
  return aggregateReadingStats(classShapes, logs, books);
}

/** admin 학생 상세용: 읽은 book_id 목록 */
export async function getReadBookIdsAsAdmin(studentId: string): Promise<number[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];
  const admin = createAdminClient();
  const rows = await fetchAllRows<{ book_id: number }>((from, to) =>
    admin.from("raz_read_logs").select("book_id").eq("student_id", studentId).range(from, to),
  );
  return rows.map((r) => r.book_id);
}

/** admin 학생 상세용: 학생 이름 */
export async function getStudentNameAsAdmin(
  studentId: string,
): Promise<{ korean_name: string | null; english_name: string | null } | null> {
  const auth = await verifyAdmin();
  if ("error" in auth) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("students")
    .select("korean_name, english_name")
    .eq("id", studentId)
    .single();
  return data ?? null;
}

/** admin 읽음 토글. user-context client 사용 — RLS admin 정책 통과 (이중 방어). */
export async function toggleRazReadAsAdmin(
  studentId: string,
  bookId: number,
  read: boolean,
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const supabase = await createClient();
  if (read) {
    const { error } = await supabase
      .from("raz_read_logs")
      .upsert({ student_id: studentId, book_id: bookId, marked_by: auth.userId }, { ignoreDuplicates: true });
    if (error) return { error: "저장에 실패했습니다." };
  } else {
    const { error } = await supabase
      .from("raz_read_logs")
      .delete()
      .eq("student_id", studentId)
      .eq("book_id", bookId);
    if (error) return { error: "삭제에 실패했습니다." };
  }

  revalidatePath("/admin/reading");
  revalidatePath(`/admin/reading/${studentId}`);
  revalidatePath("/academy/student/reading");
  revalidatePath(`/academy/teacher/reading/${studentId}`);
  return {};
}

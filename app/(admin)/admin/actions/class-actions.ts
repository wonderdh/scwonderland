"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ClassWithDetails, ClassStudentRow } from "@/lib/types";

export async function listClassesWithDetails(): Promise<ClassWithDetails[]> {
  const supabase = createAdminClient();
  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id, name, teacher_profile_id, created_at, updated_at")
    .order("name");
  if (classesError) {
    console.error("[listClassesWithDetails]", classesError.message);
    return [];
  }
  if (!classes?.length) {
    return [];
  }
  const teacherIds = [
    ...new Set(
      (classes as { teacher_profile_id: string | null }[])
        .map((c) => c.teacher_profile_id)
        .filter(Boolean) as string[]
    ),
  ];
  let teacherMap = new Map<string, string>();
  if (teacherIds.length > 0) {
    const { data: teachers } = await supabase
      .from("teachers")
      .select("profile_id, name")
      .in("profile_id", teacherIds);
    teacherMap = new Map(
      (teachers ?? []).map((t) => [t.profile_id, t.name ?? ""])
    );
  }
  const { data: members } = await supabase
    .from("class_students")
    .select("class_id");
  const countByClass = (members ?? []).reduce(
    (acc, row) => {
      acc[row.class_id] = (acc[row.class_id] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    teacher_profile_id: c.teacher_profile_id,
    teacher_name: c.teacher_profile_id
      ? teacherMap.get(c.teacher_profile_id) ?? null
      : null,
    student_count: countByClass[c.id] ?? 0,
    created_at: c.created_at,
    updated_at: c.updated_at,
  }));
}

export async function getClassWithStudents(
  classId: string
): Promise<{ class: ClassWithDetails | null; students: ClassStudentRow[] }> {
  const supabase = createAdminClient();
  const list = await listClassesWithDetails();
  const classRow = list.find((c) => c.id === classId) ?? null;
  if (!classRow) {
    return { class: null, students: [] };
  }
  const { data: rows } = await supabase
    .from("class_students")
    .select("id, student_profile_id")
    .eq("class_id", classId);
  if (!rows?.length) {
    return { class: classRow, students: [] };
  }
  const profileIds = rows.map((r) => r.student_profile_id);
  const { data: students } = await supabase
    .from("students")
    .select("profile_id, korean_name, english_name, student_number")
    .in("profile_id", profileIds);
  const studentMap = new Map(
    (students ?? []).map((s) => [s.profile_id, s])
  );
  const studentsList: ClassStudentRow[] = rows.map((r) => {
    const s = studentMap.get(r.student_profile_id);
    return {
      id: r.id,
      student_profile_id: r.student_profile_id,
      korean_name: s?.korean_name ?? null,
      english_name: s?.english_name ?? null,
      student_number: s?.student_number ?? null,
    };
  });
  return { class: classRow, students: studentsList };
}

/** 모든 반의 소속 학생 목록 (class_id별 그룹용). 반 검색 시 학생 이름으로도 찾을 수 있게. */
export async function getAllClassStudentsFlat(): Promise<
  { class_id: string; id: string; student_profile_id: string; korean_name: string | null; english_name: string | null; student_number: string | null }[]
> {
  const supabase = createAdminClient();
  const { data: rows } = await supabase
    .from("class_students")
    .select("id, class_id, student_profile_id");
  if (!rows?.length) return [];
  const profileIds = [...new Set(rows.map((r) => r.student_profile_id))];
  const { data: students } = await supabase
    .from("students")
    .select("profile_id, korean_name, english_name, student_number")
    .in("profile_id", profileIds);
  const studentMap = new Map(
    (students ?? []).map((s) => [s.profile_id, s])
  );
  return rows.map((r) => {
    const s = studentMap.get(r.student_profile_id);
    return {
      class_id: r.class_id,
      id: r.id,
      student_profile_id: r.student_profile_id,
      korean_name: s?.korean_name ?? null,
      english_name: s?.english_name ?? null,
      student_number: s?.student_number ?? null,
    };
  });
}

export async function createClass(
  name: string,
  teacherProfileId: string | null
): Promise<{ error?: string; id?: string }> {
  const supabase = createAdminClient();
  const n = name?.trim();
  if (!n) return { error: "반 이름을 입력해 주세요." };
  const { data, error } = await supabase
    .from("classes")
    .insert({
      name: n,
      teacher_profile_id: teacherProfileId || null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[createClass]", error.message, { name });
    return { error: error.message };
  }
  return { id: data.id };
}

export async function updateClass(
  classId: string,
  name: string,
  teacherProfileId: string | null
): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const n = name?.trim();
  if (!n) return { error: "반 이름을 입력해 주세요." };
  const { error } = await supabase
    .from("classes")
    .update({
      name: n,
      teacher_profile_id: teacherProfileId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", classId);
  if (error) {
    console.error("[updateClass]", error.message, { classId, name });
    return { error: error.message };
  }
  return {};
}

export async function deleteClass(classId: string): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("classes").delete().eq("id", classId);
  if (error) {
    console.error("[deleteClass]", error.message, { classId });
    return { error: error.message };
  }
  return {};
}

export async function addStudentToClass(
  classId: string,
  studentProfileId: string
): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("class_students").insert({
    class_id: classId,
    student_profile_id: studentProfileId,
  });
  if (error) {
    console.error("[addStudentToClass]", error.message, { classId, studentProfileId });
    return { error: error.message };
  }
  return {};
}

export async function removeStudentFromClass(
  classStudentId: string
): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("class_students")
    .delete()
    .eq("id", classStudentId);
  if (error) {
    console.error("[removeStudentFromClass]", error.message, { classStudentId });
    return { error: error.message };
  }
  return {};
}

export async function listTeachersForSelect(): Promise<
  { id: string; name: string }[]
> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("teachers")
    .select("profile_id, name")
    .order("name");
  return (data ?? []).map((t) => ({ id: t.profile_id, name: t.name ?? "" }));
}

export async function listStudentsNotInClass(
  classId: string
): Promise<{ id: string; korean_name: string | null; english_name: string | null; student_number: string | null }[]> {
  const supabase = createAdminClient();
  const { data: inClass } = await supabase
    .from("class_students")
    .select("student_profile_id")
    .eq("class_id", classId);
  const ids = new Set((inClass ?? []).map((r) => r.student_profile_id));
  const { data: students } = await supabase
    .from("students")
    .select("profile_id, korean_name, english_name, student_number");
  return (students ?? [])
    .filter((s) => !ids.has(s.profile_id))
    .map((s) => ({
      id: s.profile_id,
      korean_name: s.korean_name ?? null,
      english_name: s.english_name ?? null,
      student_number: s.student_number ?? null,
    }));
}

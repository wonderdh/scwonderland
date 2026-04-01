"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin, verifyAuthenticated } from "./auth-helpers";
import { logger } from "@/lib/logger";
import type { ClassWithDetails, ClassStudentRow, ClassTeacherInfo, AdminStudentClassItem } from "@/lib/types";

// ── 내부 헬퍼: class_id → 교사 목록 매핑 ──
async function buildClassTeacherMap(
  supabase: ReturnType<typeof createAdminClient>,
  classIds: string[],
): Promise<Map<string, ClassTeacherInfo[]>> {
  if (!classIds.length) return new Map();

  const { data: classTeachers } = await supabase
    .from("class_teachers")
    .select("class_id, teacher_profile_id")
    .in("class_id", classIds);

  const teacherIds = [...new Set((classTeachers ?? []).map((ct) => ct.teacher_profile_id))];
  if (!teacherIds.length) return new Map();

  const { data: teachers } = await supabase
    .from("teachers")
    .select("profile_id, name, teacher_type")
    .in("profile_id", teacherIds);

  const teacherMap = new Map((teachers ?? []).map((t) => [t.profile_id, t]));
  const result = new Map<string, ClassTeacherInfo[]>();

  for (const ct of classTeachers ?? []) {
    const teacher = teacherMap.get(ct.teacher_profile_id);
    if (!teacher) continue;
    const list = result.get(ct.class_id) ?? [];
    list.push({
      profile_id: teacher.profile_id,
      name: teacher.name ?? "",
      teacher_type: (teacher.teacher_type ?? "korean") as "korean" | "native",
    });
    result.set(ct.class_id, list);
  }

  return result;
}

export async function listClassesWithDetails(): Promise<ClassWithDetails[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];
  const supabase = createAdminClient();
  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id, name, group_label, color_index, created_at, updated_at")
    .order("name");
  if (classesError) {
    console.error("[listClassesWithDetails]", classesError.message);
    return [];
  }
  if (!classes?.length) {
    return [];
  }

  const classIds = classes.map((c) => c.id);
  const teachersByClass = await buildClassTeacherMap(supabase, classIds);

  const [{ data: members }, { data: schedules }] = await Promise.all([
    supabase.from("class_students").select("class_id"),
    supabase.from("class_schedules").select("class_id"),
  ]);
  const countByClass = (members ?? []).reduce(
    (acc, row) => {
      acc[row.class_id] = (acc[row.class_id] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const scheduleCountByClass = (schedules ?? []).reduce(
    (acc, row) => {
      acc[row.class_id] = (acc[row.class_id] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    group_label: (c.group_label ?? null) as "유치부" | "방과후" | "오후반" | null,
    color_index: c.color_index ?? null,
    teachers: teachersByClass.get(c.id) ?? [],
    student_count: countByClass[c.id] ?? 0,
    schedule_count: scheduleCountByClass[c.id] ?? 0,
    created_at: c.created_at,
    updated_at: c.updated_at,
  }));
}

export async function getClassWithStudents(
  classId: string
): Promise<{ class: ClassWithDetails | null; students: ClassStudentRow[] }> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { class: null, students: [] };
  const supabase = createAdminClient();

  // 직접 단일 반 조회 (N+1 쿼리 제거)
  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("id, name, group_label, color_index, created_at, updated_at")
    .eq("id", classId)
    .single();

  if (classError || !classRow) {
    return { class: null, students: [] };
  }

  // 교사 정보 조회
  const classTeacherMap = await buildClassTeacherMap(supabase, [classId]);
  const teachers: ClassTeacherInfo[] = classTeacherMap.get(classId) ?? [];

  // 학생 수
  const { count: studentCount } = await supabase
    .from("class_students")
    .select("*", { count: "exact", head: true })
    .eq("class_id", classId);

  const classWithDetails: ClassWithDetails = {
    id: classRow.id,
    name: classRow.name,
    group_label: (classRow.group_label ?? null) as "유치부" | "방과후" | "오후반" | null,
    color_index: classRow.color_index ?? null,
    teachers,
    student_count: studentCount ?? 0,
    schedule_count: 0,
    created_at: classRow.created_at,
    updated_at: classRow.updated_at,
  };

  // 학생 목록 조회
  const { data: rows } = await supabase
    .from("class_students")
    .select("id, student_profile_id")
    .eq("class_id", classId);
  if (!rows?.length) {
    return { class: classWithDetails, students: [] };
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
  return { class: classWithDetails, students: studentsList };
}

/** 특정 학생의 소속 반 목록 (반 이름 + 담당 교사 정보) */
export async function getStudentClasses(
  studentProfileId: string
): Promise<{ classes: AdminStudentClassItem[]; error?: string }> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { classes: [] };
  const supabase = createAdminClient();

  const { data: members, error: membersError } = await supabase
    .from("class_students")
    .select("class_id")
    .eq("student_profile_id", studentProfileId);
  if (membersError) {
    console.error("[getStudentClasses]", membersError.message);
    return { classes: [], error: membersError.message };
  }
  if (!members?.length) return { classes: [] };

  const classIds = members.map((m) => m.class_id);
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .in("id", classIds)
    .order("name");
  if (!classes?.length) return { classes: [] };

  const classTeacherMap = await buildClassTeacherMap(supabase, classIds);

  return {
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      teachers: (classTeacherMap.get(c.id) ?? []).map((t) => ({
        name: t.name,
        teacher_type: t.teacher_type,
      })),
    })),
  };
}

/** 모든 반의 소속 학생 목록 (class_id별 그룹용). 반 검색 시 학생 이름으로도 찾을 수 있게. */
export async function getAllClassStudentsFlat(): Promise<
  { class_id: string; id: string; student_profile_id: string; korean_name: string | null; english_name: string | null; student_number: string | null }[]
> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];
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
  teacherProfileIds: string[],
  groupLabel?: string,
  colorIndex?: number | null,
): Promise<{ error?: string; id?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const n = name?.trim();
  if (!n) return { error: "반 이름을 입력해 주세요." };
  const { data, error } = await supabase
    .from("classes")
    .insert({ name: n, group_label: groupLabel || null, color_index: colorIndex ?? null })
    .select("id")
    .single();
  if (error) {
    console.error("[createClass]", error.message, { name });
    return { error: error.message };
  }
  // 교사 배정
  if (teacherProfileIds.length > 0) {
    const { error: ctError } = await supabase
      .from("class_teachers")
      .insert(teacherProfileIds.map((tid) => ({ class_id: data.id, teacher_profile_id: tid })));
    if (ctError) {
      console.error("[createClass:teachers]", ctError.message);
      return { error: "교사 배정에 실패했습니다." };
    }
  }

  logger.info("[createClass]", "반 생성 완료", { id: data.id, name: n, groupLabel });
  revalidatePath("/admin/classes");

  // 유치부 자동 배정: 모든 교시×요일 슬롯을 빈 상태로 생성
  if (groupLabel === "유치부") {
    const { data: kindergartenPeriods } = await supabase
      .from("academy_periods")
      .select("id")
      .eq("group_label", "유치부")
      .eq("is_active", true);

    if (kindergartenPeriods?.length) {
      const rows = kindergartenPeriods.flatMap((p) =>
        [1, 2, 3, 4, 5].map((day) => ({
          class_id: data.id,
          academy_period_id: p.id,
          day_of_week: day,
          teacher_profile_id: null,
          label: null,
          textbook_id: null,
        })),
      );
      const { error: autoErr } = await supabase.from("class_schedules").insert(rows);
      if (autoErr && autoErr.code !== "23505") {
        console.error("[createClass:autoAssign]", autoErr.message);
      }
    }
  }

  return { id: data.id };
}

export async function updateClass(
  classId: string,
  name: string,
  teacherProfileIds: string[],
  groupLabel?: string,
  colorIndex?: number | null,
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const n = name?.trim();
  if (!n) return { error: "반 이름을 입력해 주세요." };
  const { error } = await supabase
    .from("classes")
    .update({
      name: n,
      group_label: groupLabel || null,
      color_index: colorIndex ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", classId);
  if (error) {
    console.error("[updateClass]", error.message, { classId, name });
    return { error: error.message };
  }
  // 교사 재배정: 기존 삭제 → 새로 삽입
  const { error: deleteError } = await supabase.from("class_teachers").delete().eq("class_id", classId);
  if (deleteError) {
    console.error("[updateClass:teachers:delete]", deleteError.message);
    return { error: "교사 배정 수정에 실패했습니다." };
  }
  if (teacherProfileIds.length > 0) {
    const { error: ctError } = await supabase
      .from("class_teachers")
      .insert(teacherProfileIds.map((tid) => ({ class_id: classId, teacher_profile_id: tid })));
    if (ctError) {
      console.error("[updateClass:teachers]", ctError.message);
      return { error: "교사 배정 수정에 실패했습니다." };
    }
  }

  logger.info("[updateClass]", "반 수정 완료", { classId, name: n, groupLabel });
  revalidatePath("/admin/classes");

  // 유치부 자동 배정: 비어있는 슬롯만 추가 (기존 배정 보존)
  if (groupLabel === "유치부") {
    const { data: kindergartenPeriods } = await supabase
      .from("academy_periods")
      .select("id")
      .eq("group_label", "유치부")
      .eq("is_active", true);

    if (kindergartenPeriods?.length) {
      const { data: existing } = await supabase
        .from("class_schedules")
        .select("academy_period_id, day_of_week")
        .eq("class_id", classId)
        .is("student_profile_id", null);

      const existingSet = new Set(
        (existing ?? []).map((e) => `${e.academy_period_id}_${e.day_of_week}`),
      );

      const rows = kindergartenPeriods.flatMap((p) =>
        [1, 2, 3, 4, 5]
          .filter((day) => !existingSet.has(`${p.id}_${day}`))
          .map((day) => ({
            class_id: classId,
            academy_period_id: p.id,
            day_of_week: day,
            teacher_profile_id: null,
            label: null,
            textbook_id: null,
          })),
      );

      if (rows.length > 0) {
        const { error: autoErr } = await supabase.from("class_schedules").insert(rows);
        if (autoErr && autoErr.code !== "23505") {
          console.error("[updateClass:autoAssign]", autoErr.message);
        }
      }
    }
  }

  return {};
}

export async function deleteClass(classId: string): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const { error } = await supabase.from("classes").delete().eq("id", classId);
  if (error) {
    console.error("[deleteClass]", error.message, { classId });
    return { error: error.message };
  }
  logger.info("[deleteClass]", "반 삭제 완료", { classId });
  revalidatePath("/admin/classes");
  return {};
}

/** 삭제 전 경고용: 반의 연관 데이터 건수 조회 */
export async function getClassLinkedCounts(
  classId: string
): Promise<{ studentCount: number; homeworkCount: number; noticeCount: number }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { studentCount: 0, homeworkCount: 0, noticeCount: 0 };

  const supabase = createAdminClient();
  const [{ count: studentCount }, { count: homeworkCount }, { count: noticeCount }] = await Promise.all([
    supabase.from("class_students").select("*", { count: "exact", head: true }).eq("class_id", classId),
    supabase.from("homework_assignments").select("*", { count: "exact", head: true }).eq("class_id", classId),
    supabase.from("class_notices").select("*", { count: "exact", head: true }).eq("class_id", classId),
  ]);
  return {
    studentCount: studentCount ?? 0,
    homeworkCount: homeworkCount ?? 0,
    noticeCount: noticeCount ?? 0,
  };
}

export async function addStudentToClass(
  classId: string,
  studentProfileId: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const { error } = await supabase.from("class_students").insert({
    class_id: classId,
    student_profile_id: studentProfileId,
  });
  if (error) {
    console.error("[addStudentToClass]", error.message, { classId, studentProfileId });
    return { error: error.message };
  }
  logger.info("[addStudentToClass]", "학생 반 배정", { classId, studentProfileId });
  revalidatePath("/admin/classes");
  return {};
}

export async function removeStudentFromClass(
  classStudentId: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  // 반 소속 정보 조회 (방과후 등록 정리에 필요)
  const { data: classStudent } = await supabase
    .from("class_students")
    .select("class_id, student_profile_id")
    .eq("id", classStudentId)
    .single();

  // 방과후 등록 삭제 (방과후 반이 아닌 경우 무해하게 0건 삭제)
  if (classStudent) {
    await supabase
      .from("afterschool_enrollments")
      .delete()
      .eq("class_id", classStudent.class_id)
      .eq("student_profile_id", classStudent.student_profile_id);
  }

  const { error } = await supabase
    .from("class_students")
    .delete()
    .eq("id", classStudentId);
  if (error) {
    console.error("[removeStudentFromClass]", error.message, { classStudentId });
    return { error: error.message };
  }
  logger.info("[removeStudentFromClass]", "학생 반 제외", { classStudentId });
  revalidatePath("/admin/classes");
  return {};
}

export async function listTeachersForSelect(): Promise<
  { id: string; name: string; teacher_type: "korean" | "native" }[]
> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];
  const supabase = createAdminClient();

  // 소프트 삭제되지 않은 교사만 조회
  const { data: activeProfileIds } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "teacher")
    .is("deleted_at", null);
  const activeIds = (activeProfileIds ?? []).map((p) => p.id);
  if (activeIds.length === 0) return [];

  const { data } = await supabase
    .from("teachers")
    .select("profile_id, name, teacher_type")
    .in("profile_id", activeIds)
    .order("name");
  return (data ?? []).map((t) => ({
    id: t.profile_id,
    name: t.name ?? "",
    teacher_type: (t.teacher_type ?? "korean") as "korean" | "native",
  }));
}

export async function listStudentsNotInClass(
  classId: string
): Promise<{ id: string; korean_name: string | null; english_name: string | null; student_number: string | null }[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];
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

export async function batchUpdateClassStudents(
  removes: string[],
  adds: { classId: string; profileId: string }[]
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  if (removes.length > 0) {
    // afterschool_enrollments 정리
    const { data: classStudents } = await supabase
      .from("class_students")
      .select("class_id, student_profile_id")
      .in("id", removes);
    if (classStudents?.length) {
      for (const cs of classStudents) {
        await supabase
          .from("afterschool_enrollments")
          .delete()
          .eq("class_id", cs.class_id)
          .eq("student_profile_id", cs.student_profile_id);
      }
    }
    const { error } = await supabase.from("class_students").delete().in("id", removes);
    if (error) return { error: error.message };
  }

  if (adds.length > 0) {
    const { error } = await supabase
      .from("class_students")
      .insert(adds.map((a) => ({ class_id: a.classId, student_profile_id: a.profileId })));
    if (error) return { error: error.message };
  }

  logger.info("[batchUpdateClassStudents]", "학생 배정 일괄 저장", {
    removes: removes.length,
    adds: adds.length,
  });
  revalidatePath("/admin/classes");
  return {};
}

/** 비밀번호 일괄 내보내기용 — 반별 학생 ID 목록 (관리자 전용) */
export async function listClassesWithStudentIds(): Promise<
  { id: string; name: string; studentProfileIds: string[] }[]
> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];
  const supabase = createAdminClient();

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .order("name");
  if (!classes?.length) return [];

  const { data: rows } = await supabase
    .from("class_students")
    .select("class_id, student_profile_id");

  const classStudentMap = new Map<string, string[]>();
  for (const row of rows ?? []) {
    const list = classStudentMap.get(row.class_id) ?? [];
    list.push(row.student_profile_id);
    classStudentMap.set(row.class_id, list);
  }

  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    studentProfileIds: classStudentMap.get(c.id) ?? [],
  }));
}

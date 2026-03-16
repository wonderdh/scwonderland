"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin, verifyAuthenticated } from "./auth-helpers";
import type { ClassWithDetails, ClassStudentRow, ClassTeacherInfo, AdminStudentClassItem } from "@/lib/types";

export async function listClassesWithDetails(): Promise<ClassWithDetails[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];
  const supabase = createAdminClient();
  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id, name, group_label, created_at, updated_at")
    .order("name");
  if (classesError) {
    console.error("[listClassesWithDetails]", classesError.message);
    return [];
  }
  if (!classes?.length) {
    return [];
  }

  // class_teachers 중간 테이블에서 교사 매핑 조회
  const classIds = classes.map((c) => c.id);
  const { data: classTeachers } = await supabase
    .from("class_teachers")
    .select("class_id, teacher_profile_id")
    .in("class_id", classIds);

  const teacherIds = [
    ...new Set(
      (classTeachers ?? []).map((ct) => ct.teacher_profile_id)
    ),
  ];
  let teacherMap = new Map<string, { name: string; teacher_type: string }>();
  if (teacherIds.length > 0) {
    const { data: teachers } = await supabase
      .from("teachers")
      .select("profile_id, name, teacher_type")
      .in("profile_id", teacherIds);
    teacherMap = new Map(
      (teachers ?? []).map((t) => [t.profile_id, { name: t.name ?? "", teacher_type: t.teacher_type ?? "korean" }])
    );
  }

  // 반별 교사 목록 구성
  const teachersByClass = new Map<string, ClassTeacherInfo[]>();
  for (const ct of classTeachers ?? []) {
    const info = teacherMap.get(ct.teacher_profile_id);
    if (!info) continue;
    const list = teachersByClass.get(ct.class_id) ?? [];
    list.push({
      profile_id: ct.teacher_profile_id,
      name: info.name,
      teacher_type: info.teacher_type as "korean" | "native",
    });
    teachersByClass.set(ct.class_id, list);
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
    group_label: (c.group_label ?? null) as "유치부" | "방과후" | "오후반" | null,
    teachers: teachersByClass.get(c.id) ?? [],
    student_count: countByClass[c.id] ?? 0,
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
    .select("id, name, group_label, created_at, updated_at")
    .eq("id", classId)
    .single();

  if (classError || !classRow) {
    return { class: null, students: [] };
  }

  // 교사 정보 조회
  const { data: classTeachers } = await supabase
    .from("class_teachers")
    .select("teacher_profile_id")
    .eq("class_id", classId);

  const teacherIds = (classTeachers ?? []).map((ct) => ct.teacher_profile_id);
  let teachers: ClassTeacherInfo[] = [];
  if (teacherIds.length > 0) {
    const { data: teacherRows } = await supabase
      .from("teachers")
      .select("profile_id, name, teacher_type")
      .in("profile_id", teacherIds);
    teachers = (teacherRows ?? []).map((t) => ({
      profile_id: t.profile_id,
      name: t.name ?? "",
      teacher_type: (t.teacher_type ?? "korean") as "korean" | "native",
    }));
  }

  // 학생 수
  const { count: studentCount } = await supabase
    .from("class_students")
    .select("*", { count: "exact", head: true })
    .eq("class_id", classId);

  const classWithDetails: ClassWithDetails = {
    id: classRow.id,
    name: classRow.name,
    group_label: (classRow.group_label ?? null) as "유치부" | "방과후" | "오후반" | null,
    teachers,
    student_count: studentCount ?? 0,
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

  // class_teachers 중간 테이블에서 교사 매핑 조회
  const { data: classTeachers } = await supabase
    .from("class_teachers")
    .select("class_id, teacher_profile_id")
    .in("class_id", classIds);

  const teacherIds = [
    ...new Set((classTeachers ?? []).map((ct) => ct.teacher_profile_id)),
  ];
  let teacherMap = new Map<string, { name: string; teacher_type: string }>();
  if (teacherIds.length > 0) {
    const { data: teachers } = await supabase
      .from("teachers")
      .select("profile_id, name, teacher_type")
      .in("profile_id", teacherIds);
    teacherMap = new Map(
      (teachers ?? []).map((t) => [t.profile_id, { name: t.name ?? "", teacher_type: t.teacher_type ?? "korean" }])
    );
  }

  return {
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      teachers: (classTeachers ?? [])
        .filter((ct) => ct.class_id === c.id)
        .map((ct) => {
          const t = teacherMap.get(ct.teacher_profile_id);
          return {
            name: t?.name ?? null,
            teacher_type: (t?.teacher_type ?? "korean") as "korean" | "native",
          };
        }),
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
): Promise<{ error?: string; id?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const n = name?.trim();
  if (!n) return { error: "반 이름을 입력해 주세요." };
  const { data, error } = await supabase
    .from("classes")
    .insert({ name: n, group_label: groupLabel || null })
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
  revalidatePath("/admin/classes");
  return {};
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

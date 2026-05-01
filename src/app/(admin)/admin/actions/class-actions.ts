"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin, verifyAuthenticated } from "./auth-helpers";
import { logger } from "@/lib/server/logger";
import type { ClassWithDetails, ClassStudentRow, ClassTeacherInfo, AdminStudentClassItem } from "@/lib/types";
import {
  getStudentRecordByProfileId,
  getStudentsByIds,
  getTeacherRecordByProfileId,
  getTeachersByIds,
  getUserIdsByRole,
  toGroupLabel,
  toGroupType,
} from "@/lib/server/domain-helpers";

async function buildClassTeacherMap(
  supabase: ReturnType<typeof createAdminClient>,
  classIds: string[]
): Promise<Map<string, ClassTeacherInfo[]>> {
  if (!classIds.length) return new Map();

  const { data: classTeachers } = await supabase
    .from("class_teachers")
    .select("class_id, teacher_id")
    .in("class_id", classIds);
  const teacherIds = [...new Set((classTeachers ?? []).map((row) => row.teacher_id))];
  const teachersById = await getTeachersByIds(supabase, teacherIds);

  const result = new Map<string, ClassTeacherInfo[]>();
  for (const row of classTeachers ?? []) {
    const teacher = teachersById.get(row.teacher_id);
    if (!teacher) continue;
    const list = result.get(row.class_id) ?? [];
    list.push({
      profile_id: teacher.profile_id,
      name: teacher.name ?? "",
      teacher_type: (teacher.teacher_type ?? "korean") as "korean" | "native",
    });
    result.set(row.class_id, list);
  }

  return result;
}

export async function listClassesWithDetails(): Promise<ClassWithDetails[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];
  const supabase = createAdminClient();

  const { data: classes, error } = await supabase
    .from("classes")
    .select("id, name, group_type, group_label, color_index, created_at, updated_at")
    .order("name");
  if (error || !classes?.length) {
    if (error) logger.error("[listClassesWithDetails]", error.message);
    return [];
  }

  const classIds = classes.map((item) => item.id);
  const teachersByClass = await buildClassTeacherMap(supabase, classIds);
  const [{ data: members }, { data: schedules }] = await Promise.all([
    supabase.from("class_students").select("class_id"),
    supabase.from("class_schedules").select("class_id"),
  ]);

  const studentCountByClass = (members ?? []).reduce((acc, row) => {
    acc[row.class_id] = (acc[row.class_id] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const scheduleCountByClass = (schedules ?? []).reduce((acc, row) => {
    acc[row.class_id] = (acc[row.class_id] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return classes.map((item) => ({
    id: item.id,
    name: item.name,
    group_label: (item.group_label ?? toGroupLabel(item.group_type) ?? null) as ClassWithDetails["group_label"],
    color_index: item.color_index ?? null,
    teachers: teachersByClass.get(item.id) ?? [],
    student_count: studentCountByClass[item.id] ?? 0,
    schedule_count: scheduleCountByClass[item.id] ?? 0,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }));
}

export async function getClassWithStudents(
  classId: string
): Promise<{ class: ClassWithDetails | null; students: ClassStudentRow[] }> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { class: null, students: [] };
  const supabase = createAdminClient();

  const { data: classRow, error } = await supabase
    .from("classes")
    .select("id, name, group_type, group_label, color_index, created_at, updated_at")
    .eq("id", classId)
    .single();
  if (error || !classRow) return { class: null, students: [] };

  const teachers = (await buildClassTeacherMap(supabase, [classId])).get(classId) ?? [];
  const { count: studentCount } = await supabase
    .from("class_students")
    .select("*", { count: "exact", head: true })
    .eq("class_id", classId);

  const { data: rows } = await supabase
    .from("class_students")
    .select("id, student_id")
    .eq("class_id", classId);
  const studentIds = (rows ?? []).map((row) => row.student_id);
  const studentsById = await getStudentsByIds(supabase, studentIds);

  return {
    class: {
      id: classRow.id,
      name: classRow.name,
      group_label: (classRow.group_label ?? toGroupLabel(classRow.group_type) ?? null) as ClassWithDetails["group_label"],
      color_index: classRow.color_index ?? null,
      teachers,
      student_count: studentCount ?? 0,
      schedule_count: 0,
      created_at: classRow.created_at,
      updated_at: classRow.updated_at,
    },
    students: (rows ?? []).map((row) => {
      const student = studentsById.get(row.student_id);
      return {
        id: row.id,
        student_profile_id: student?.profile_id ?? "",
        korean_name: student?.korean_name ?? null,
        english_name: student?.english_name ?? null,
        age: student?.age ?? null,
        student_number: null,
      };
    }),
  };
}

export async function getStudentClasses(
  studentProfileId: string
): Promise<{ classes: AdminStudentClassItem[]; error?: string }> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { classes: [] };
  const supabase = createAdminClient();

  const student = await getStudentRecordByProfileId(supabase, studentProfileId);
  if (!student) return { classes: [] };

  const { data: memberships, error } = await supabase
    .from("class_students")
    .select("class_id")
    .eq("student_id", student.id);
  if (error) return { classes: [], error: error.message };
  if (!memberships?.length) return { classes: [] };

  const classIds = memberships.map((row) => row.class_id);
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .in("id", classIds)
    .order("name");
  const classTeacherMap = await buildClassTeacherMap(supabase, classIds);

  return {
    classes: (classes ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      teachers: (classTeacherMap.get(item.id) ?? []).map((teacher) => ({
        name: teacher.name,
        teacher_type: teacher.teacher_type,
      })),
    })),
  };
}

export async function getAllClassStudentsFlat(): Promise<
  { class_id: string; id: string; student_profile_id: string; korean_name: string | null; english_name: string | null; student_number: string | null }[]
> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];
  const supabase = createAdminClient();

  const { data: rows } = await supabase.from("class_students").select("id, class_id, student_id");
  const studentsById = await getStudentsByIds(
    supabase,
    [...new Set((rows ?? []).map((row) => row.student_id))]
  );

  return (rows ?? []).map((row) => {
    const student = studentsById.get(row.student_id);
    return {
      class_id: row.class_id,
      id: row.id,
      student_profile_id: student?.profile_id ?? "",
      korean_name: student?.korean_name ?? null,
      english_name: student?.english_name ?? null,
      student_number: null,
    };
  });
}

export async function createClass(
  name: string,
  teacherProfileIds: string[],
  groupLabel?: string,
  colorIndex?: number | null
): Promise<{ error?: string; id?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const normalizedName = name?.trim();
  if (!normalizedName) return { error: "반 이름을 입력해 주세요." };

  const groupType = toGroupType(groupLabel ?? null);
  const { data, error } = await supabase
    .from("classes")
    .insert({
      name: normalizedName,
      group_type: groupType ?? "kindergarten",
      group_label: groupLabel ?? toGroupLabel(groupType ?? "kindergarten"),
      color_index: colorIndex ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "반 생성에 실패했습니다." };

  if (teacherProfileIds.length) {
    const teacherRows = await Promise.all(teacherProfileIds.map((profileId) => getTeacherRecordByProfileId(supabase, profileId)));
    const teacherIds = teacherRows.filter(Boolean).map((row) => row!.id);
    if (teacherIds.length) {
      const { error: teacherError } = await supabase
        .from("class_teachers")
        .insert(teacherIds.map((teacherId) => ({ class_id: data.id, teacher_id: teacherId })));
      if (teacherError) return { error: teacherError.message };
    }
  }

  const { data: periods } = await supabase
    .from("academy_periods")
    .select("id")
    .eq("group_type", groupType ?? "kindergarten")
    .eq("is_active", true);
  if (periods?.length) {
    const rows = periods.flatMap((period) =>
      [1, 2, 3, 4, 5].map((day) => ({
        class_id: data.id,
        academy_period_id: period.id,
        day_of_week: day,
        teacher_id: null,
        label: null,
      }))
    );
    await supabase.from("class_schedules").insert(rows);
  }

  revalidatePath("/admin/classes");
  return { id: data.id };
}

export async function updateClass(
  classId: string,
  name: string,
  teacherProfileIds: string[],
  groupLabel?: string,
  colorIndex?: number | null
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const normalizedName = name?.trim();
  if (!normalizedName) return { error: "반 이름을 입력해 주세요." };

  const groupType = toGroupType(groupLabel ?? null);
  const { error } = await supabase
    .from("classes")
    .update({
      name: normalizedName,
      group_type: groupType ?? "kindergarten",
      group_label: groupLabel ?? toGroupLabel(groupType ?? "kindergarten"),
      color_index: colorIndex ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", classId);
  if (error) return { error: error.message };

  await supabase.from("class_teachers").delete().eq("class_id", classId);
  if (teacherProfileIds.length) {
    const teacherRows = await Promise.all(teacherProfileIds.map((profileId) => getTeacherRecordByProfileId(supabase, profileId)));
    const teacherIds = teacherRows.filter(Boolean).map((row) => row!.id);
    if (teacherIds.length) {
      const { error: teacherError } = await supabase
        .from("class_teachers")
        .insert(teacherIds.map((teacherId) => ({ class_id: classId, teacher_id: teacherId })));
      if (teacherError) return { error: teacherError.message };
    }
  }

  revalidatePath("/admin/classes");
  return {};
}

export async function deleteClass(classId: string): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const { error } = await supabase.from("classes").delete().eq("id", classId);
  if (error) return { error: error.message };
  revalidatePath("/admin/classes");
  return {};
}

export async function getClassLinkedCounts(
  classId: string
): Promise<{ studentCount: number; homeworkCount: number; noticeCount: number }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { studentCount: 0, homeworkCount: 0, noticeCount: 0 };
  const supabase = createAdminClient();
  const { count: studentCount } = await supabase
    .from("class_students")
    .select("*", { count: "exact", head: true })
    .eq("class_id", classId);
  return { studentCount: studentCount ?? 0, homeworkCount: 0, noticeCount: 0 };
}

export async function addStudentToClass(classId: string, studentProfileId: string): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const student = await getStudentRecordByProfileId(supabase, studentProfileId);
  if (!student) return { error: "학생 정보를 찾을 수 없습니다." };
  const { error } = await supabase.from("class_students").insert({
    class_id: classId,
    student_id: student.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/classes");
  return {};
}

export async function removeStudentFromClass(classStudentId: string): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  const { data: classStudent } = await supabase
    .from("class_students")
    .select("class_id, student_id")
    .eq("id", classStudentId)
    .maybeSingle();

  if (classStudent) {
    await supabase
      .from("afterschool_enrollments")
      .delete()
      .eq("class_id", classStudent.class_id)
      .eq("student_id", classStudent.student_id);
  }

  const { error } = await supabase.from("class_students").delete().eq("id", classStudentId);
  if (error) return { error: error.message };
  revalidatePath("/admin/classes");
  return {};
}

export async function listTeachersForSelect(): Promise<
  { id: string; name: string; teacher_type: "korean" | "native" }[]
> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];
  const supabase = createAdminClient();
  const teacherIds = await getUserIdsByRole(supabase, "teacher");
  if (!teacherIds.length) return [];

  const { data: activeProfiles } = await supabase
    .from("profiles")
    .select("id")
    .in("id", teacherIds)
    .is("deleted_at", null);
  const profileIds = (activeProfiles ?? []).map((profile) => profile.id);
  if (!profileIds.length) return [];

  const { data } = await supabase
    .from("teachers")
    .select("id, name, teacher_type")
    .in("id", profileIds)
    .order("name");
  return (data ?? []).map((teacher) => ({
    id: teacher.id,
    name: teacher.name ?? "",
    teacher_type: (teacher.teacher_type ?? "korean") as "korean" | "native",
  }));
}

export async function listStudentsNotInClass(
  classId: string
): Promise<{ id: string; korean_name: string | null; english_name: string | null; student_number: string | null }[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];
  const supabase = createAdminClient();

  const { data: memberships } = await supabase
    .from("class_students")
    .select("student_id")
    .eq("class_id", classId);
  const assignedStudentIds = new Set((memberships ?? []).map((row) => row.student_id));

  const activeProfileIds = await getUserIdsByRole(supabase, "student");
  const { data: activeProfiles } = await supabase
    .from("profiles")
    .select("id")
    .in("id", activeProfileIds)
    .is("deleted_at", null);
  const profileIds = (activeProfiles ?? []).map((profile) => profile.id);

  const { data: students } = await supabase
    .from("students")
    .select("id, korean_name, english_name")
    .in("id", profileIds);
  return (students ?? [])
    .filter((student) => !assignedStudentIds.has(student.id))
    .map((student) => ({
      id: student.id,
      korean_name: student.korean_name ?? null,
      english_name: student.english_name ?? null,
      student_number: null,
    }));
}

export async function batchUpdateClassStudents(
  removes: string[],
  adds: { classId: string; profileId: string }[]
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();

  if (removes.length) {
    const { data: classStudents } = await supabase
      .from("class_students")
      .select("class_id, student_id")
      .in("id", removes);
    for (const classStudent of classStudents ?? []) {
      await supabase
        .from("afterschool_enrollments")
        .delete()
        .eq("class_id", classStudent.class_id)
        .eq("student_id", classStudent.student_id);
    }
    const { error } = await supabase.from("class_students").delete().in("id", removes);
    if (error) return { error: error.message };
  }

  if (adds.length) {
    const rows = await Promise.all(
      adds.map(async (item) => {
        const student = await getStudentRecordByProfileId(supabase, item.profileId);
        return student ? { class_id: item.classId, student_id: student.id } : null;
      })
    );
    const inserts = rows.filter(Boolean);
    if (inserts.length) {
      const { error } = await supabase.from("class_students").insert(inserts);
      if (error) return { error: error.message };
    }
  }

  revalidatePath("/admin/classes");
  return {};
}

export async function listClassesWithStudentIds(): Promise<
  { id: string; name: string; colorIndex: number | null; studentProfileIds: string[] }[]
> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];
  const supabase = createAdminClient();

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, group_type, group_label, color_index")
    .neq("group_type", "afterschool")
    .order("name");
  if (!classes?.length) return [];

  const { data: rows } = await supabase.from("class_students").select("class_id, student_id");
  const studentsById = await getStudentsByIds(
    supabase,
    [...new Set((rows ?? []).map((row) => row.student_id))]
  );

  const classStudentMap = new Map<string, string[]>();
  for (const row of rows ?? []) {
    const profileId = studentsById.get(row.student_id)?.profile_id;
    if (!profileId) continue;
    const list = classStudentMap.get(row.class_id) ?? [];
    list.push(profileId);
    classStudentMap.set(row.class_id, list);
  }

  return classes.map((item) => ({
    id: item.id,
    name: item.name,
    colorIndex: item.color_index ?? null,
    studentProfileIds: classStudentMap.get(item.id) ?? [],
  }));
}

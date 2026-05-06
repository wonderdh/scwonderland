"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEmail } from "@/lib/auth/auth-utils";
import { revalidatePath } from "next/cache";
import { verifyAdmin } from "./auth-helpers";
import { logger } from "@/lib/server/logger";
import type { UserWithProfile } from "@/lib/types";
import {
  getStudentRecordByProfileId,
  getTeacherRecordByProfileId,
  getUserIdsByRole,
  toGroupLabel,
} from "@/lib/server/domain-helpers";

async function listAuthUsersMap(supabase: ReturnType<typeof createAdminClient>, ids: string[]) {
  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const idSet = new Set(ids);
  return new Map((data?.users ?? []).filter((user) => idSet.has(user.id)).map((user) => [user.id, user]));
}

export async function createStudent(formData: FormData): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const email = normalizeEmail((formData.get("email") as string) ?? "");
  const password = (formData.get("password") as string) ?? "";
  const korean_name = (formData.get("korean_name") as string)?.trim() ?? "";
  const english_name = (formData.get("english_name") as string)?.trim() ?? "";
  const ageStr = formData.get("age") as string;
  const age = ageStr ? parseInt(ageStr, 10) : null;
  const groupTypeRaw = (formData.get("group_type") as string) ?? "";
  const group_type = groupTypeRaw === "유치부" || groupTypeRaw === "오후반" ? groupTypeRaw : null;

  if (!email || !password || !korean_name) {
    return { error: "아이디, 비밀번호, 한글 이름을 입력해 주세요." };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: korean_name,
      last_name: english_name,
      role: "student",
    },
  });

  if (error) {
    logger.error("[createStudent]", error.message);
    return { error: error.message };
  }
  if (!data.user) return { error: "사용자 생성에 실패했습니다." };

  const profileId = data.user.id;
  const username = email.split("@")[0];

  // students.id → profiles.id FK 가 있어 profile 을 먼저 commit 한 뒤 student insert.
  // 과거 Promise.all 병렬 인서트는 race condition 으로 students_profiles_fkey 위반 발생.
  const { error: profileError } = await supabase.from("profiles").insert({
    id: profileId,
    username,
    role: "student",
  });
  if (profileError) {
    logger.error("[createStudent:profile]", profileError.message, { profileId });
    return { error: profileError.message };
  }

  const { error: studentError } = await supabase.from("students").insert({
    id: profileId,
    korean_name,
    english_name: english_name || null,
    age: age !== null && !isNaN(age) ? age : null,
    group_type,
  });
  if (studentError) {
    logger.error("[createStudent:student]", studentError.message, { profileId });
    return { error: studentError.message };
  }

  revalidatePath("/admin", "layout");
  return {};
}

export async function createTeacher(formData: FormData): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const email = normalizeEmail((formData.get("email") as string) ?? "");
  const password = (formData.get("password") as string) ?? "";
  const name = (formData.get("name") as string)?.trim() ?? "";
  const teacher_type = (formData.get("teacher_type") as string) ?? "korean";

  if (!email || !password || !name) {
    return { error: "아이디, 비밀번호, 이름을 입력해 주세요." };
  }
  if (teacher_type !== "korean" && teacher_type !== "native") {
    return { error: "교사 유형을 선택해 주세요." };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: name,
      role: "teacher",
    },
  });

  if (error) {
    logger.error("[createTeacher]", error.message);
    return { error: error.message };
  }
  if (!data.user) return { error: "사용자 생성에 실패했습니다." };

  const profileId = data.user.id;
  const username = email.split("@")[0];

  // teachers.id → profiles.id FK 가 있어 profile 을 먼저 commit 한 뒤 teacher insert.
  const { error: profileError } = await supabase.from("profiles").insert({
    id: profileId,
    username,
    role: "teacher",
  });
  if (profileError) {
    logger.error("[createTeacher:profile]", profileError.message, { profileId });
    return { error: profileError.message };
  }

  const { error: teacherError } = await supabase.from("teachers").insert({
    id: profileId,
    name,
    teacher_type,
  });
  if (teacherError) {
    logger.error("[createTeacher:teacher]", teacherError.message, { profileId });
    return { error: teacherError.message };
  }

  revalidatePath("/admin", "layout");
  return {};
}

export async function listAdmins(): Promise<{ id: string; email: string; name: string; created_at: string }[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];

  const supabase = createAdminClient();
  const adminIds = await getUserIdsByRole(supabase, "admin");
  if (!adminIds.length) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, deleted_at")
    .in("id", adminIds)
    .is("deleted_at", null);
  if (!profiles?.length) return [];

  const authUsers = await listAuthUsersMap(supabase, profiles.map((profile) => profile.id));
  return profiles
    .map((profile) => {
      const user = authUsers.get(profile.id);
      return {
        id: profile.id,
        email: user?.email ?? "",
        name: profile.username ?? user?.email?.split("@")[0] ?? "",
        created_at: user?.created_at ?? "",
      };
    })
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function listUsersByRole(role: "student" | "teacher"): Promise<UserWithProfile[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];

  const supabase = createAdminClient();
  const roleIds = await getUserIdsByRole(supabase, role);
  if (!roleIds.length) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", roleIds)
    .is("deleted_at", null);
  if (profilesError || !profiles?.length) {
    if (profilesError) logger.error("[listUsersByRole]", profilesError.message, { role });
    return [];
  }

  const ids = profiles.map((profile) => profile.id);
  const authUsers = await listAuthUsersMap(supabase, ids);

  if (role === "student") {
    const { data: students } = await supabase
      .from("students")
      .select("id, korean_name, english_name, age, group_type")
      .in("id", ids);
    const studentMap = new Map((students ?? []).map((student) => [student.id, student]));
    return profiles
      .map((profile) => {
        const student = studentMap.get(profile.id);
        return {
          id: profile.id,
          email: authUsers.get(profile.id)?.email ?? "",
          first_name: student?.korean_name ?? null,
          last_name: student?.english_name ?? null,
          korean_name: student?.korean_name ?? null,
          english_name: student?.english_name ?? null,
          age: student?.age ?? null,
          group_type: (student?.group_type as "유치부" | "오후반" | null) ?? null,
        };
      })
      .sort((a, b) => (a.korean_name ?? "").localeCompare(b.korean_name ?? "", "ko"));
  }

  const { data: teachers } = await supabase
    .from("teachers")
    .select("id, name, teacher_type")
    .in("id", ids);
  const teacherMap = new Map((teachers ?? []).map((teacher) => [teacher.id, teacher]));
  return profiles
    .map((profile) => {
      const teacher = teacherMap.get(profile.id);
      return {
        id: profile.id,
        email: authUsers.get(profile.id)?.email ?? "",
        first_name: teacher?.name ?? null,
        last_name: null,
        name: teacher?.name ?? profile.username ?? "",
        teacher_type: (teacher?.teacher_type ?? "korean") as "korean" | "native",
      };
    })
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "ko"));
}

export async function getTeacherAssignmentCounts(userId: string): Promise<{ classCount: number; scheduleCount: number }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { classCount: 0, scheduleCount: 0 };

  const supabase = createAdminClient();
  const teacher = await getTeacherRecordByProfileId(supabase, userId);
  if (!teacher) return { classCount: 0, scheduleCount: 0 };

  const [{ count: classCount }, { count: scheduleCount }] = await Promise.all([
    supabase.from("class_teachers").select("*", { count: "exact", head: true }).eq("teacher_id", teacher.id),
    supabase.from("class_schedules").select("*", { count: "exact", head: true }).eq("teacher_id", teacher.id),
  ]);

  return { classCount: classCount ?? 0, scheduleCount: scheduleCount ?? 0 };
}

export async function getStudentLinkedCounts(userId: string): Promise<{ attendanceCount: number; busDefaultCount: number; progressCount: number }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { attendanceCount: 0, busDefaultCount: 0, progressCount: 0 };

  const supabase = createAdminClient();
  const student = await getStudentRecordByProfileId(supabase, userId);
  if (!student) return { attendanceCount: 0, busDefaultCount: 0, progressCount: 0 };

  const [{ count: attendanceCount }, { count: busDefaultCount }] = await Promise.all([
    supabase.from("attendance").select("*", { count: "exact", head: true }).eq("student_id", student.id),
    supabase.from("student_bus_defaults").select("*", { count: "exact", head: true }).eq("student_id", student.id),
  ]);

  return {
    attendanceCount: attendanceCount ?? 0,
    busDefaultCount: busDefaultCount ?? 0,
    progressCount: 0,
  };
}

export async function deleteUserById(formData: FormData): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const id = (formData.get("id") as string)?.trim();
  if (!id) return { error: "id가 없습니다." };

  const supabase = createAdminClient();
  const [student, teacher] = await Promise.all([
    getStudentRecordByProfileId(supabase, id),
    getTeacherRecordByProfileId(supabase, id),
  ]);

  if (teacher) {
    await supabase.from("class_teachers").delete().eq("teacher_id", teacher.id);
    await supabase.from("class_schedules").delete().eq("teacher_id", teacher.id);
  }

  if (student) {
    await Promise.all([
      supabase.from("class_students").delete().eq("student_id", student.id),
      supabase.from("afterschool_enrollments").delete().eq("student_id", student.id),
      supabase.from("student_bus_defaults").delete().eq("student_id", student.id),
      supabase.from("attendance").delete().eq("student_id", student.id),
      supabase.from("bus_change_requests").delete().eq("student_id", student.id),
      supabase.from("bus_check_records").delete().eq("student_id", student.id),
      supabase.from("report_cards").delete().eq("student_id", student.id),
    ]);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (profileError) {
    logger.error("[deleteUserById:profile]", profileError.message, { id });
    return { error: profileError.message };
  }

  await supabase.auth.admin.updateUserById(id, {
    ban_duration: "876000h",
  });

  revalidatePath("/admin", "layout");
  return {};
}

export async function restoreUser(userId: string): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  if (!userId) return { error: "id가 없습니다." };

  const supabase = createAdminClient();
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ deleted_at: null })
    .eq("id", userId);
  if (profileError) {
    logger.error("[restoreUser:profile]", profileError.message, { userId });
    return { error: profileError.message };
  }

  await supabase.auth.admin.updateUserById(userId, { ban_duration: "none" });
  revalidatePath("/admin", "layout");
  return {};
}

export async function permanentlyDeleteUser(userId: string): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  if (!userId) return { error: "id가 없습니다." };

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    logger.error("[permanentlyDeleteUser]", error.message, { userId });
    return { error: error.message };
  }

  revalidatePath("/admin", "layout");
  return {};
}

export async function listDeletedUsers(role: "student" | "teacher"): Promise<UserWithProfile[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];

  const supabase = createAdminClient();
  const roleIds = await getUserIdsByRole(supabase, role);
  if (!roleIds.length) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, deleted_at")
    .in("id", roleIds)
    .not("deleted_at", "is", null);
  if (!profiles?.length) return [];

  const authUsers = await listAuthUsersMap(supabase, profiles.map((profile) => profile.id));

  if (role === "student") {
    const { data: students } = await supabase
      .from("students")
      .select("id, korean_name, english_name, age, group_type")
      .in("id", profiles.map((profile) => profile.id));
    const studentMap = new Map((students ?? []).map((student) => [student.id, student]));
    return profiles.map((profile) => {
      const student = studentMap.get(profile.id);
      return {
        id: profile.id,
        email: authUsers.get(profile.id)?.email ?? "",
        first_name: student?.korean_name ?? null,
        last_name: student?.english_name ?? null,
        korean_name: student?.korean_name ?? null,
        english_name: student?.english_name ?? null,
        age: student?.age ?? null,
        group_type: (student?.group_type as "유치부" | "오후반" | null) ?? null,
      };
    });
  }

  const { data: teachers } = await supabase
    .from("teachers")
    .select("id, name, teacher_type")
    .in("id", profiles.map((profile) => profile.id));
  const teacherMap = new Map((teachers ?? []).map((teacher) => [teacher.id, teacher]));
  return profiles.map((profile) => {
    const teacher = teacherMap.get(profile.id);
    return {
      id: profile.id,
      email: authUsers.get(profile.id)?.email ?? "",
      first_name: teacher?.name ?? null,
      last_name: null,
      name: teacher?.name ?? profile.username ?? "",
      teacher_type: (teacher?.teacher_type ?? "korean") as "korean" | "native",
    };
  });
}

export async function updateStudentProfile(formData: FormData): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const id = (formData.get("id") as string)?.trim();
  const korean_name = (formData.get("korean_name") as string)?.trim() ?? "";
  const english_name = (formData.get("english_name") as string)?.trim() ?? "";
  const ageStr = formData.get("age") as string;
  const age = ageStr ? parseInt(ageStr, 10) : null;
  const groupTypeRaw = (formData.get("group_type") as string) ?? "";
  const group_type = groupTypeRaw === "유치부" || groupTypeRaw === "오후반" ? groupTypeRaw : null;

  if (!id) return { error: "id가 없습니다." };
  if (!korean_name) return { error: "한글 이름을 입력해 주세요." };

  const supabase = createAdminClient();
  // upsert 로 변경: 과거 createStudent FK race(students_profiles_fkey) 로 생긴 orphan
  // (profiles 만 있고 students 없는) 케이스도 자동 복구. id 는 profiles.id FK 라
  // 이미 listUsersByRole 로 나온 id 면 무조건 유효함. select 로 영향 행 확인.
  const { data: upserted, error: studentError } = await supabase
    .from("students")
    .upsert(
      {
        id,
        korean_name,
        english_name: english_name || null,
        age: age !== null && !isNaN(age) ? age : null,
        group_type,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("id");

  if (studentError) {
    logger.error("[updateStudentProfile]", studentError.message, { id });
    return { error: studentError.message };
  }
  if (!upserted?.length) {
    logger.error("[updateStudentProfile]", "no rows affected", { id });
    return { error: "학생 정보를 저장하지 못했습니다." };
  }

  revalidatePath("/admin", "layout");
  return {};
}

export async function updateTeacherProfile(formData: FormData): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const id = (formData.get("id") as string)?.trim();
  const name = (formData.get("name") as string)?.trim() ?? "";
  const teacher_type = (formData.get("teacher_type") as string) || null;

  if (!id) return { error: "id가 없습니다." };
  if (!name) return { error: "이름을 입력해 주세요." };

  const validTeacherType =
    teacher_type === "korean" || teacher_type === "native" ? teacher_type : "korean";

  const supabase = createAdminClient();
  // upsert: orphan(profiles 만 있고 teachers 없음) 자동 복구
  const { data: upserted, error: teacherError } = await supabase
    .from("teachers")
    .upsert(
      {
        id,
        name,
        teacher_type: validTeacherType,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("id");

  if (teacherError) {
    logger.error("[updateTeacherProfile]", teacherError.message, { id });
    return { error: teacherError.message };
  }
  if (!upserted?.length) {
    logger.error("[updateTeacherProfile]", "no rows affected", { id });
    return { error: "교사 정보를 저장하지 못했습니다." };
  }

  revalidatePath("/admin", "layout");
  return {};
}

const MIN_PASSWORD_LENGTH = 8;

export async function resetUserPassword(userId: string, newPassword: string): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  if (!userId || !newPassword) return { error: "사용자 ID와 새 비밀번호를 입력해 주세요." };
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { error: `비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.` };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return {};
}

export async function bulkResetStudentPasswords(
  students: { id: string; password: string }[]
): Promise<{ success: number; failed: number; error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { success: 0, failed: 0, error: auth.error };
  if (!students.length) return { success: 0, failed: 0 };

  const invalid = students.filter((s) => !s.id || !s.password || s.password.length < MIN_PASSWORD_LENGTH);
  if (invalid.length) {
    return {
      success: 0,
      failed: 0,
      error: `${invalid.length}건의 비밀번호가 누락되었거나 ${MIN_PASSWORD_LENGTH}자 미만입니다.`,
    };
  }

  const supabase = createAdminClient();
  let success = 0;
  let failed = 0;

  for (const { id, password } of students) {
    const { error } = await supabase.auth.admin.updateUserById(id, { password });
    if (error) failed++;
    else success++;
  }

  if (success > 0) revalidatePath("/admin", "layout");
  return { success, failed };
}

export async function listAllStudents(): Promise<
  { id: string; korean_name: string | null; english_name: string | null; age: number | null; group_type: string | null }[]
> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];

  const supabase = createAdminClient();
  const activeIds = await getUserIdsByRole(supabase, "student");
  if (!activeIds.length) return [];

  // profiles + students LEFT JOIN 식 처리 — orphan(profile 만 있는 학생)도 포함해
  // 반 배정 UI 의 "미배정 학생" 패널에서 누락되지 않게 한다. 이름은 username 폴백.
  const { data: activeProfiles } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", activeIds)
    .is("deleted_at", null);
  const profiles = activeProfiles ?? [];
  if (!profiles.length) return [];

  const filteredIds = profiles.map((p) => p.id);
  const { data: students } = await supabase
    .from("students")
    .select("id, korean_name, english_name, age, group_type")
    .in("id", filteredIds);
  const studentMap = new Map((students ?? []).map((s) => [s.id, s]));

  return profiles
    .map((profile) => {
      const s = studentMap.get(profile.id);
      return {
        id: profile.id,
        korean_name: s?.korean_name ?? profile.username ?? null,
        english_name: s?.english_name ?? null,
        age: s?.age ?? null,
        group_type: s?.group_type ?? toGroupLabel(null),
      };
    })
    .sort((a, b) => (a.korean_name ?? "").localeCompare(b.korean_name ?? "", "ko"));
}

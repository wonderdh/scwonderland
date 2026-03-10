"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/auth-utils";
import { verifyAdmin } from "./auth-helpers";
import type { UserWithProfile } from "@/lib/types";

export async function createStudent(
  formData: FormData
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const email = normalizeEmail((formData.get("email") as string) ?? "");
  const password = (formData.get("password") as string) ?? "";
  const korean_name = (formData.get("korean_name") as string)?.trim() ?? "";
  const english_name = (formData.get("english_name") as string)?.trim() ?? "";

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
      korean_name,
      english_name,
    },
  });

  if (error) {
    console.error("[createStudent]", error.message, { email });
    return { error: error.message };
  }
  if (!data.user) {
    return { error: "사용자 생성에 실패했습니다." };
  }
  return {};
}

export async function createTeacher(
  formData: FormData
): Promise<{ error?: string }> {
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
      last_name: "",
      role: "teacher",
      name,
      teacher_type,
    },
  });

  if (error) {
    console.error("[createTeacher]", error.message, { email });
    return { error: error.message };
  }
  if (!data.user) {
    return { error: "사용자 생성에 실패했습니다." };
  }

  // teachers 테이블에 teacher_type 업데이트 (트리거가 기본값 korean으로 생성하므로)
  if (teacher_type === "native") {
    await supabase
      .from("teachers")
      .update({ teacher_type: "native" })
      .eq("profile_id", data.user.id);
  }

  return {};
}

export async function listUsersByRole(
  role: "student" | "teacher"
): Promise<UserWithProfile[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];

  const supabase = createAdminClient();

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .eq("role", role)
    .is("deleted_at", null);

  if (profilesError) {
    console.error("[listUsersByRole]", profilesError.message, { role });
    return [];
  }
  if (!profiles?.length) {
    return [];
  }

  const ids = profiles.map((p) => p.id);
  const { data: users } = await supabase.auth.admin.listUsers();
  const idSet = new Set(ids);
  const userMap = new Map(
    (users?.users ?? []).filter((u) => idSet.has(u.id)).map((u) => [u.id, u])
  );

  if (role === "student") {
    const { data: students } = await supabase
      .from("students")
      .select("profile_id, korean_name, english_name, student_number")
      .in("profile_id", ids);
    const studentMap = new Map(
      (students ?? []).map((s) => [s.profile_id, s])
    );
    return profiles.map((p) => {
      const u = userMap.get(p.id);
      const s = studentMap.get(p.id);
      return {
        id: p.id,
        email: u?.email ?? "",
        first_name: p.first_name,
        last_name: p.last_name,
        korean_name: s?.korean_name ?? p.first_name,
        english_name: s?.english_name ?? p.last_name,
        student_number: s?.student_number ?? null,
      };
    });
  }

  const { data: teachers } = await supabase
    .from("teachers")
    .select("profile_id, name, teacher_number, teacher_type")
    .in("profile_id", ids);
  const teacherMap = new Map(
    (teachers ?? []).map((t) => [t.profile_id, t])
  );
  return profiles.map((p) => {
    const u = userMap.get(p.id);
    const t = teacherMap.get(p.id);
    return {
      id: p.id,
      email: u?.email ?? "",
      first_name: p.first_name,
      last_name: p.last_name,
      name: t?.name ?? p.first_name,
      teacher_number: t?.teacher_number ?? null,
      teacher_type: (t?.teacher_type ?? "korean") as "korean" | "native",
    };
  });
}

/** 삭제 전 경고용: 교사의 반 담임 + 수업 배정 건수 조회 */
export async function getTeacherAssignmentCounts(
  userId: string
): Promise<{ classCount: number; scheduleCount: number }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { classCount: 0, scheduleCount: 0 };

  const supabase = createAdminClient();

  const [{ count: classCount }, { count: scheduleCount }] = await Promise.all([
    supabase
      .from("class_teachers")
      .select("*", { count: "exact", head: true })
      .eq("teacher_profile_id", userId),
    supabase
      .from("class_schedules")
      .select("*", { count: "exact", head: true })
      .eq("teacher_profile_id", userId),
  ]);

  return {
    classCount: classCount ?? 0,
    scheduleCount: scheduleCount ?? 0,
  };
}

/** 소프트 삭제: deleted_at 설정 + Auth ban */
export async function deleteUserById(
  formData: FormData
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const id = (formData.get("id") as string)?.trim();
  if (!id) return { error: "id가 없습니다." };

  const supabase = createAdminClient();

  // 1. 반 담임 배정 삭제
  const { error: classTeacherError } = await supabase
    .from("class_teachers")
    .delete()
    .eq("teacher_profile_id", id);
  if (classTeacherError) {
    console.error("[deleteUserById:class_teachers]", classTeacherError.message, { id });
  }

  // 2. 수업 배정 삭제
  const { error: scheduleError } = await supabase
    .from("class_schedules")
    .delete()
    .eq("teacher_profile_id", id);
  if (scheduleError) {
    console.error("[deleteUserById:class_schedules]", scheduleError.message, { id });
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (profileError) {
    console.error("[deleteUserById:profile]", profileError.message, { id });
    return { error: profileError.message };
  }

  const { error: banError } = await supabase.auth.admin.updateUserById(id, {
    ban_duration: "876000h",
  });
  if (banError) {
    console.error("[deleteUserById:ban]", banError.message, { id });
  }

  return {};
}

/** 복구: deleted_at 초기화 + Auth unban */
export async function restoreUser(
  userId: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  if (!userId) return { error: "id가 없습니다." };

  const supabase = createAdminClient();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ deleted_at: null })
    .eq("id", userId);
  if (profileError) {
    console.error("[restoreUser:profile]", profileError.message, { userId });
    return { error: profileError.message };
  }

  const { error: unbanError } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });
  if (unbanError) {
    console.error("[restoreUser:unban]", unbanError.message, { userId });
  }

  return {};
}

/** 영구 삭제: Auth 유저 삭제 (DB CASCADE) */
export async function permanentlyDeleteUser(
  userId: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  if (!userId) return { error: "id가 없습니다." };

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    console.error("[permanentlyDeleteUser]", error.message, { userId });
    return { error: error.message };
  }
  return {};
}

/** 삭제된 유저 목록 조회 */
export async function listDeletedUsers(
  role: "student" | "teacher"
): Promise<UserWithProfile[]> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];

  const supabase = createAdminClient();

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, deleted_at")
    .eq("role", role)
    .not("deleted_at", "is", null);

  if (profilesError || !profiles?.length) return [];

  const ids = profiles.map((p) => p.id);
  const { data: users } = await supabase.auth.admin.listUsers();
  const idSet = new Set(ids);
  const userMap = new Map(
    (users?.users ?? []).filter((u) => idSet.has(u.id)).map((u) => [u.id, u])
  );

  if (role === "student") {
    const { data: students } = await supabase
      .from("students")
      .select("profile_id, korean_name, english_name, student_number")
      .in("profile_id", ids);
    const studentMap = new Map(
      (students ?? []).map((s) => [s.profile_id, s])
    );
    return profiles.map((p) => {
      const u = userMap.get(p.id);
      const s = studentMap.get(p.id);
      return {
        id: p.id,
        email: u?.email ?? "",
        first_name: p.first_name,
        last_name: p.last_name,
        korean_name: s?.korean_name ?? p.first_name,
        english_name: s?.english_name ?? p.last_name,
        student_number: s?.student_number ?? null,
      };
    });
  }

  const { data: teachers } = await supabase
    .from("teachers")
    .select("profile_id, name, teacher_number, teacher_type")
    .in("profile_id", ids);
  const teacherMap = new Map(
    (teachers ?? []).map((t) => [t.profile_id, t])
  );
  return profiles.map((p) => {
    const u = userMap.get(p.id);
    const t = teacherMap.get(p.id);
    return {
      id: p.id,
      email: u?.email ?? "",
      first_name: p.first_name,
      last_name: p.last_name,
      name: t?.name ?? p.first_name,
      teacher_number: t?.teacher_number ?? null,
      teacher_type: (t?.teacher_type ?? "korean") as "korean" | "native",
    };
  });
}

export async function updateStudentProfile(
  formData: FormData
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const id = (formData.get("id") as string)?.trim();
  const korean_name = (formData.get("korean_name") as string)?.trim() ?? "";
  const english_name = (formData.get("english_name") as string)?.trim() ?? "";

  if (!id) return { error: "id가 없습니다." };
  if (!korean_name) return { error: "한글 이름을 입력해 주세요." };

  const supabase = createAdminClient();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ first_name: korean_name, last_name: english_name })
    .eq("id", id);
  if (profileError) {
    console.error("[updateStudentProfile:profile]", profileError.message, { id });
    return { error: profileError.message };
  }

  const { error: studentError } = await supabase
    .from("students")
    .update({ korean_name, english_name, updated_at: new Date().toISOString() })
    .eq("profile_id", id);

  if (studentError) {
    console.error("[updateStudentProfile]", studentError.message, { id });
    return { error: studentError.message };
  }
  return {};
}

export async function updateTeacherProfile(
  formData: FormData
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const id = (formData.get("id") as string)?.trim();
  const name = (formData.get("name") as string)?.trim() ?? "";
  const teacher_type = (formData.get("teacher_type") as string) || null;

  if (!id) return { error: "id가 없습니다." };
  if (!name) return { error: "이름을 입력해 주세요." };

  const supabase = createAdminClient();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ first_name: name, last_name: "" })
    .eq("id", id);
  if (profileError) {
    console.error("[updateTeacherProfile:profile]", profileError.message, { id });
    return { error: profileError.message };
  }

  const updateData: Record<string, unknown> = { name, updated_at: new Date().toISOString() };
  if (teacher_type === "korean" || teacher_type === "native") {
    updateData.teacher_type = teacher_type;
  }

  const { error: teacherError } = await supabase
    .from("teachers")
    .update(updateData)
    .eq("profile_id", id);

  if (teacherError) {
    console.error("[updateTeacherProfile]", teacherError.message, { id });
    return { error: teacherError.message };
  }
  return {};
}

export async function resetUserPassword(
  userId: string,
  newPassword: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  if (!userId || !newPassword) {
    return { error: "사용자 ID와 새 비밀번호를 입력해 주세요." };
  }
  if (newPassword.length < 6) {
    return { error: "비밀번호는 최소 6자 이상이어야 합니다." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (error) {
    console.error("[resetUserPassword]", error.message, { userId });
    return { error: error.message };
  }
  return {};
}

export async function listAllStudents(): Promise<
  { id: string; korean_name: string | null; english_name: string | null; student_number: string | null }[]
> {
  const auth = await verifyAdmin();
  if ("error" in auth) return [];

  const supabase = createAdminClient();

  // 소프트 삭제되지 않은 학생만 조회
  const { data: activeProfileIds } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "student")
    .is("deleted_at", null);
  const activeIds = (activeProfileIds ?? []).map((p) => p.id);
  if (activeIds.length === 0) return [];

  const { data: students } = await supabase
    .from("students")
    .select("profile_id, korean_name, english_name, student_number")
    .in("profile_id", activeIds)
    .order("korean_name");
  return (students ?? []).map((s) => ({
    id: s.profile_id,
    korean_name: s.korean_name ?? null,
    english_name: s.english_name ?? null,
    student_number: s.student_number ?? null,
  }));
}

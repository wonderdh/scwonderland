"use server";

import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL_DOMAIN = process.env.NEXT_PUBLIC_EMAIL_DOMAIN ?? "scwonderland.com";

function normalizeEmail(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  return s.includes("@") ? s : `${s}@${EMAIL_DOMAIN}`;
}

export type UserWithProfile = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  korean_name?: string | null;
  english_name?: string | null;
  student_number?: string | null;
  name?: string | null;
  teacher_number?: string | null;
};

export async function createStudent(
  formData: FormData
): Promise<{ error?: string }> {
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
  const email = normalizeEmail((formData.get("email") as string) ?? "");
  const password = (formData.get("password") as string) ?? "";
  const name = (formData.get("name") as string)?.trim() ?? "";

  if (!email || !password || !name) {
    return { error: "아이디, 비밀번호, 이름을 입력해 주세요." };
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
    },
  });

  if (error) {
    return { error: error.message };
  }
  if (!data.user) {
    return { error: "사용자 생성에 실패했습니다." };
  }
  return {};
}

export async function listUsersByRole(
  role: "student" | "teacher"
): Promise<UserWithProfile[]> {
  const supabase = createAdminClient();

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .eq("role", role);

  if (profilesError || !profiles?.length) {
    return [];
  }

  const ids = profiles.map((p) => p.id);
  const { data: users } = await supabase.auth.admin.listUsers();
  const userMap = new Map(
    (users?.users ?? []).filter((u) => ids.includes(u.id)).map((u) => [u.id, u])
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
    .select("profile_id, name, teacher_number")
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
    };
  });
}

export async function deleteUserById(
  formData: FormData
): Promise<{ error?: string }> {
  const id = (formData.get("id") as string)?.trim();
  if (!id) return { error: "id가 없습니다." };

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) return { error: error.message };
  return {};
}

export async function updateStudentProfile(
  formData: FormData
): Promise<{ error?: string }> {
  const id = (formData.get("id") as string)?.trim();
  const korean_name = (formData.get("korean_name") as string)?.trim() ?? "";
  const english_name = (formData.get("english_name") as string)?.trim() ?? "";

  if (!id) return { error: "id가 없습니다." };
  if (!korean_name) return { error: "한글 이름을 입력해 주세요." };

  const supabase = createAdminClient();

  await supabase
    .from("profiles")
    .update({ first_name: korean_name, last_name: english_name })
    .eq("id", id);

  const { error: studentError } = await supabase
    .from("students")
    .update({ korean_name, english_name, updated_at: new Date().toISOString() })
    .eq("profile_id", id);

  if (studentError) return { error: studentError.message };
  return {};
}

export async function updateTeacherProfile(
  formData: FormData
): Promise<{ error?: string }> {
  const id = (formData.get("id") as string)?.trim();
  const name = (formData.get("name") as string)?.trim() ?? "";

  if (!id) return { error: "id가 없습니다." };
  if (!name) return { error: "이름을 입력해 주세요." };

  const supabase = createAdminClient();

  await supabase
    .from("profiles")
    .update({ first_name: name, last_name: "" })
    .eq("id", id);

  const { error: teacherError } = await supabase
    .from("teachers")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("profile_id", id);

  if (teacherError) return { error: teacherError.message };
  return {};
}

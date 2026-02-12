"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

// --- Report cards (admin/teacher: 본문 작성·수정, 학생: 답글만) ---

export type ReportCard = {
  id: string;
  student_profile_id: string;
  year: number;
  month: number;
  author_id: string | null;
  content: string | null;
  reply: string | null;
  created_at: string;
  updated_at: string;
};

/** 선택한 학생·년·월의 리포트카드 1건 조회 (없으면 null). admin/선생/해당 학생만 조회 가능(RLS). */
export async function getReportCard(
  studentProfileId: string,
  year: number,
  month: number
): Promise<ReportCard | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_cards")
    .select("id, student_profile_id, year, month, author_id, content, reply, created_at, updated_at")
    .eq("student_profile_id", studentProfileId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();
  if (error) return null;
  return data as ReportCard | null;
}

/** 해당 학생의 리포트카드 목록 (년·월 내림차순). admin/선생/해당 학생만 조회 가능(RLS). */
export type ReportCardListItem = { id: string; year: number; month: number };

export async function listReportCardsByStudent(
  studentProfileId: string
): Promise<ReportCardListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_cards")
    .select("id, year, month")
    .eq("student_profile_id", studentProfileId)
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  if (error) return [];
  return (data ?? []) as ReportCardListItem[];
}

/** 리포트카드 본문 작성/수정. 선생 또는 admin만 가능. author_id는 현재 로그인 사용자. */
export async function upsertReportCard(
  studentProfileId: string,
  year: number,
  month: number,
  content: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["admin", "teacher"].includes(profile.role ?? "")) {
    return { error: "리포트카드 작성 권한이 없습니다." };
  }

  const y = Number(year);
  const m = Number(month);
  if (y < 2000 || y > 2100 || m < 1 || m > 12) {
    return { error: "년도 또는 월이 올바르지 않습니다." };
  }

  const { error } = await supabase.from("report_cards").upsert(
    {
      student_profile_id: studentProfileId,
      year: y,
      month: m,
      author_id: user.id,
      content: content.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_profile_id,year,month" }
  );
  if (error) return { error: error.message };
  return {};
}

/** 학생이 자신의 리포트카드에 답글만 작성/수정. 본문이 있을 때만 허용. */
export async function updateReportCardReply(
  reportCardId: string,
  reply: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { data: row } = await supabase
    .from("report_cards")
    .select("id, student_profile_id, content")
    .eq("id", reportCardId)
    .single();
  if (!row) return { error: "리포트카드를 찾을 수 없습니다." };
  if (row.student_profile_id !== user.id) return { error: "본인 리포트카드만 답글을 달 수 있습니다." };
  if (row.content == null || row.content === "") {
    return { error: "본문이 작성된 후에 답글을 남길 수 있습니다." };
  }

  const { error } = await supabase
    .from("report_cards")
    .update({ reply: reply.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", reportCardId);
  if (error) return { error: error.message };
  return {};
}

// --- Classes (반 관리, admin만) ---

export type ClassWithDetails = {
  id: string;
  name: string;
  teacher_profile_id: string | null;
  teacher_name: string | null;
  student_count: number;
  created_at: string;
  updated_at: string;
};

export async function listClassesWithDetails(): Promise<ClassWithDetails[]> {
  const supabase = createAdminClient();
  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("id, name, teacher_profile_id, created_at, updated_at")
    .order("name");
  if (classesError || !classes?.length) {
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

export type ClassStudentRow = {
  id: string;
  student_profile_id: string;
  korean_name: string | null;
  english_name: string | null;
  student_number: string | null;
};

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
  if (error) return { error: error.message };
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
  if (error) return { error: error.message };
  return {};
}

export async function deleteClass(classId: string): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("classes").delete().eq("id", classId);
  if (error) return { error: error.message };
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
  if (error) return { error: error.message };
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
  if (error) return { error: error.message };
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

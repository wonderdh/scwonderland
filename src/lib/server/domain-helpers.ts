import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export const GROUP_LABEL_TO_TYPE = {
  유치부: "kindergarten",
  오후반: "afternoon",
  방과후: "afterschool",
} as const;

export const GROUP_TYPE_TO_LABEL = {
  kindergarten: "유치부",
  afternoon: "오후반",
  afterschool: "방과후",
} as const;

export type GroupLabel = keyof typeof GROUP_LABEL_TO_TYPE;
export type GroupType = keyof typeof GROUP_TYPE_TO_LABEL;

export function toGroupLabel(groupType: string | null | undefined): GroupLabel | null {
  if (!groupType) return null;
  return GROUP_TYPE_TO_LABEL[groupType as GroupType] ?? null;
}

export function toGroupType(groupLabel: string | null | undefined): GroupType | null {
  if (!groupLabel) return null;
  return GROUP_LABEL_TO_TYPE[groupLabel as GroupLabel] ?? null;
}

// profiles.role 기준으로 역할별 profile ID 목록 반환
export async function getUserIdsByRole(
  supabase: AdminClient,
  role: "admin" | "teacher" | "student"
): Promise<string[]> {
  const { data } = await supabase.from("profiles").select("id").eq("role", role);
  return (data ?? []).map((row) => row.id);
}

// students.id = profiles.id (shared PK). profile_id는 하위 호환용 alias.
type StudentRecord = {
  id: string;
  profile_id: string;
  korean_name: string | null;
  english_name: string | null;
  age: number | null;
  group_type: string | null;
};

type TeacherRecord = {
  id: string;
  profile_id: string;
  name: string | null;
  teacher_type: "korean" | "native" | null;
};

export async function getStudentRecordByProfileId(
  supabase: AdminClient,
  profileId: string
): Promise<StudentRecord | null> {
  const { data } = await supabase
    .from("students")
    .select("id, korean_name, english_name, age, group_type")
    .eq("id", profileId)
    .maybeSingle();
  if (!data) return null;
  return { ...data, profile_id: data.id };
}

/**
 * profile_id 에 해당하는 students 행을 보장. 없으면 profiles.username 기반으로 stub 생성.
 * 과거 createStudent FK race condition 으로 생긴 orphan(profiles 만 있고 students 없음)
 * 자동 복구. 호출 전 profile 이 student 역할인지 확인 권장.
 */
export async function ensureStudentRecord(
  supabase: AdminClient,
  profileId: string
): Promise<StudentRecord | null> {
  const existing = await getStudentRecordByProfileId(supabase, profileId);
  if (existing) return existing;

  // orphan 판별: profile 이 student 역할인 경우만 자동 복구
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, role")
    .eq("id", profileId)
    .maybeSingle();
  if (!profile || profile.role !== "student") return null;

  const fallbackName = profile.username?.trim() || "이름 미입력";
  const { data: created, error } = await supabase
    .from("students")
    .insert({ id: profileId, korean_name: fallbackName })
    .select("id, korean_name, english_name, age, group_type")
    .single();
  if (error || !created) return null;
  return { ...created, profile_id: created.id };
}

export async function getTeacherRecordByProfileId(
  supabase: AdminClient,
  profileId: string
): Promise<TeacherRecord | null> {
  const { data } = await supabase
    .from("teachers")
    .select("id, name, teacher_type")
    .eq("id", profileId)
    .maybeSingle();
  if (!data) return null;
  return { ...data, profile_id: data.id };
}

export async function getStudentsByIds(
  supabase: AdminClient,
  studentIds: string[]
): Promise<Map<string, StudentRecord>> {
  if (!studentIds.length) return new Map();
  const { data } = await supabase
    .from("students")
    .select("id, korean_name, english_name, age, group_type")
    .in("id", studentIds);
  return new Map(
    (data ?? []).map((row) => [row.id, { ...row, profile_id: row.id }])
  );
}

export async function getTeachersByIds(
  supabase: AdminClient,
  teacherIds: string[]
): Promise<Map<string, TeacherRecord>> {
  if (!teacherIds.length) return new Map();
  const { data } = await supabase
    .from("teachers")
    .select("id, name, teacher_type")
    .in("id", teacherIds);
  return new Map(
    (data ?? []).map((row) => [row.id, { ...row, profile_id: row.id }])
  );
}

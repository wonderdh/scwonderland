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

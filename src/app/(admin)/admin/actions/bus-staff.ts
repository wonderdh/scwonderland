"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEmail } from "@/lib/auth/auth-utils";
import { verifyAdmin } from "./auth-helpers";
import { logger } from "@/lib/server/logger";
import type { BusStaffProfile } from "@/lib/types";

// ── 버스 담당자 CRUD ──

export async function createBusStaff(
  formData: FormData
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const email = normalizeEmail((formData.get("email") as string) ?? "");
  const password = (formData.get("password") as string) ?? "";
  const name = (formData.get("name") as string)?.trim() ?? "";
  const busNumberId = (formData.get("bus_number_id") as string) || null;

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
      role: "bus",
      name,
    },
  });

  if (error) {
    logger.error("[createBusStaff]", error.message, { email });
    return { error: error.message };
  }
  if (!data.user) {
    return { error: "사용자 생성에 실패했습니다." };
  }

  // 트리거가 bus_staff 레코드를 자동 생성 → bus_number_id 업데이트
  if (busNumberId) {
    await supabase
      .from("bus_staff")
      .update({ bus_number_id: busNumberId, updated_at: new Date().toISOString() })
      .eq("profile_id", data.user.id);
  }

  return {};
}

export async function listBusStaff(): Promise<BusStaffProfile[]> {
  const supabase = createAdminClient();

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, first_name")
    .eq("role", "bus")
    .is("deleted_at", null);

  if (profilesError) {
    logger.error("[listBusStaff]", profilesError.message);
    return [];
  }
  if (!profiles?.length) return [];

  const ids = profiles.map((p) => p.id);

  // Auth 이메일 조회
  const { data: users } = await supabase.auth.admin.listUsers();
  const userMap = new Map(
    (users?.users ?? []).filter((u) => ids.includes(u.id)).map((u) => [u.id, u])
  );

  // bus_staff 조인
  const { data: staffRows } = await supabase
    .from("bus_staff")
    .select("id, profile_id, name, bus_number_id, created_at")
    .in("profile_id", ids);
  const staffMap = new Map(
    (staffRows ?? []).map((s) => [s.profile_id, s])
  );

  // bus_numbers 조인
  const busIds = [...new Set((staffRows ?? []).filter((s) => s.bus_number_id).map((s) => s.bus_number_id))];
  let busMap = new Map<string, string>();
  if (busIds.length) {
    const { data: buses } = await supabase
      .from("bus_numbers")
      .select("id, label")
      .in("id", busIds);
    busMap = new Map((buses ?? []).map((b) => [b.id, b.label]));
  }

  return profiles.map((p) => {
    const u = userMap.get(p.id);
    const s = staffMap.get(p.id);
    return {
      id: s?.id ?? "",
      profile_id: p.id,
      email: u?.email ?? "",
      name: s?.name ?? p.first_name ?? "",
      bus_number_id: s?.bus_number_id ?? null,
      bus_label: s?.bus_number_id ? (busMap.get(s.bus_number_id) ?? null) : null,
      created_at: s?.created_at ?? "",
    };
  }) as BusStaffProfile[];
}

export async function updateBusStaff(
  profileId: string,
  name: string,
  busNumberId: string | null
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };
  const trimmed = name.trim();
  if (!trimmed) return { error: "이름을 입력해 주세요." };

  const supabase = createAdminClient();

  const { error: staffError } = await supabase
    .from("bus_staff")
    .update({
      name: trimmed,
      bus_number_id: busNumberId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("profile_id", profileId);

  if (staffError) {
    logger.error("[updateBusStaff]", staffError.message);
    return { error: staffError.message };
  }

  // profiles.first_name도 동기화
  await supabase
    .from("profiles")
    .update({ first_name: trimmed })
    .eq("id", profileId);

  return {};
}

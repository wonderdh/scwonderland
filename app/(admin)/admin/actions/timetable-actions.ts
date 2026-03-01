"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { AcademyPeriod } from "@/lib/types";

// ── 수업 시간대 CRUD ──

export async function listAcademyPeriods(): Promise<AcademyPeriod[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("academy_periods")
    .select("*")
    .eq("is_active", true)
    .order("start_time");
  if (error) {
    console.error("[listAcademyPeriods]", error.message);
    return [];
  }
  return data as AcademyPeriod[];
}

export async function createAcademyPeriod(
  name: string,
  startTime: string,
  endTime: string,
  hasPickup: boolean,
  hasDropoff: boolean,
  groupLabel?: string
): Promise<{ error?: string; id?: string }> {
  const supabase = createAdminClient();
  const trimmed = name.trim();
  if (!trimmed) return { error: "수업 이름을 입력해 주세요." };
  if (!startTime || !endTime) return { error: "시작/종료 시간을 입력해 주세요." };

  const { data, error } = await supabase
    .from("academy_periods")
    .insert({
      name: trimmed,
      start_time: startTime,
      end_time: endTime,
      has_pickup: hasPickup,
      has_dropoff: hasDropoff,
      group_label: groupLabel?.trim() || null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[createAcademyPeriod]", error.message);
    return { error: error.message };
  }
  return { id: data.id };
}

export async function updateAcademyPeriod(
  id: string,
  name: string,
  startTime: string,
  endTime: string,
  hasPickup: boolean,
  hasDropoff: boolean,
  groupLabel?: string
): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const trimmed = name.trim();
  if (!trimmed) return { error: "수업 이름을 입력해 주세요." };

  const { error } = await supabase
    .from("academy_periods")
    .update({
      name: trimmed,
      start_time: startTime,
      end_time: endTime,
      has_pickup: hasPickup,
      has_dropoff: hasDropoff,
      group_label: groupLabel?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    console.error("[updateAcademyPeriod]", error.message);
    return { error: error.message };
  }
  return {};
}

export async function deleteAcademyPeriod(id: string): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("academy_periods")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[deleteAcademyPeriod]", error.message);
    return { error: error.message };
  }
  return {};
}

"use server";

/**
 * 학원 공통 쉬는날(휴원일) 관리.
 *
 * 지정된 날짜는 숙제 unit↔채점일 계산(getUnitSchedule)의 skipDates 에 합집합되어
 * 숙제 부여·채점일에서 제외된다 (homework-unit-actions.ts 참고).
 *
 * 저장 컨벤션: 하루 = 한 row (academy_closed_days.closed_date UNIQUE).
 * 기간(범위) 입력은 addAcademyClosedDays 에서 개별 날짜로 펼쳐 upsert.
 */
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdmin, verifyAuthenticated } from "./auth-helpers";
import { logger } from "@/lib/server/logger";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const REVALIDATE_PATHS = [
  "/admin/closed-days",
  "/admin/homework",
  "/m/homework",
  "/academy/teacher/homework",
  "/academy/student/homework",
] as const;

function revalidateAll() {
  for (const p of REVALIDATE_PATHS) revalidatePath(p);
}

/** YYYY-MM-DD 의 다음 날을 YYYY-MM-DD 로 반환 (KST 안전, UTC 기반 계산). */
function nextYmd(ymdStr: string): string {
  const [y, m, d] = ymdStr.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

export type AcademyClosedDay = { closed_date: string; label: string | null };

/** 모든 쉬는날 (날짜 오름차순). teacher/admin 읽기 가능. */
export async function listAcademyClosedDays(): Promise<{
  days: AcademyClosedDay[];
  error?: string;
}> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { days: [], error: auth.error };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("academy_closed_days")
    .select("closed_date, label")
    .order("closed_date", { ascending: true });

  if (error) {
    logger.error("[listAcademyClosedDays]", error.message);
    return { days: [], error: error.message };
  }

  return {
    days: (data ?? []).map((r) => ({
      closed_date: r.closed_date as string,
      label: (r.label as string | null) ?? null,
    })),
  };
}

/**
 * 쉬는날 추가. 단일(startDate) 또는 기간(startDate~endDate).
 * 기간은 개별 날짜로 펼쳐 upsert(onConflict closed_date, ignoreDuplicates)
 * — 이미 등록된 날짜는 라벨을 덮어쓰지 않고 건너뛴다.
 */
export async function addAcademyClosedDays(input: {
  startDate: string;
  endDate?: string | null;
  label?: string | null;
}): Promise<{ error?: string; added: number }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error, added: 0 };

  const start = (input.startDate ?? "").trim();
  if (!ISO_DATE_RE.test(start)) {
    return { error: "시작 날짜가 올바르지 않습니다.", added: 0 };
  }
  const end = input.endDate?.trim() ? input.endDate.trim() : start;
  if (!ISO_DATE_RE.test(end)) {
    return { error: "종료 날짜가 올바르지 않습니다.", added: 0 };
  }
  if (end < start) {
    return { error: "종료 날짜는 시작 날짜 이후여야 합니다.", added: 0 };
  }

  const label = input.label?.trim() ? input.label.trim() : null;

  // 시작~종료 펼치기 (최대 366일 가드 — 비정상 범위 방어).
  const dates: string[] = [];
  let cur = start;
  for (let i = 0; i < 366 && cur <= end; i++) {
    dates.push(cur);
    cur = nextYmd(cur);
  }
  if (dates.length === 0) {
    return { error: "추가할 날짜가 없습니다.", added: 0 };
  }
  if (cur <= end) {
    return { error: "기간이 너무 깁니다 (최대 366일).", added: 0 };
  }

  const supabase = createAdminClient();
  const rows = dates.map((d) => ({
    closed_date: d,
    label,
    created_by: auth.userId,
  }));

  const { error } = await supabase
    .from("academy_closed_days")
    .upsert(rows, { onConflict: "closed_date", ignoreDuplicates: true });

  if (error) {
    logger.error("[addAcademyClosedDays]", error.message);
    return { error: error.message, added: 0 };
  }

  revalidateAll();
  return { added: dates.length };
}

/** 쉬는날 1건 삭제 (closed_date 기준). admin 전용. */
export async function removeAcademyClosedDay(
  closedDate: string
): Promise<{ error?: string }> {
  const auth = await verifyAdmin();
  if ("error" in auth) return { error: auth.error };

  const d = (closedDate ?? "").trim();
  if (!ISO_DATE_RE.test(d)) return { error: "날짜가 올바르지 않습니다." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("academy_closed_days")
    .delete()
    .eq("closed_date", d);

  if (error) {
    logger.error("[removeAcademyClosedDay]", error.message);
    return { error: error.message };
  }

  revalidateAll();
  return {};
}

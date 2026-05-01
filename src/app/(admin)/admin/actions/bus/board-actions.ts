"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuthenticated } from "../auth-helpers";
import { logger } from "@/lib/server/logger";
import { getStudentRecordByProfileId } from "@/lib/server/domain-helpers";

// ── 탑승 체크 ──

export async function boardBusStudent(
  studentProfileId: string,
  checkDate: string,
  busTimeSlotId: string,
  busNumberId: string
): Promise<{ error?: string }> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const student = await getStudentRecordByProfileId(supabase, studentProfileId);
  if (!student) return { error: "학생 정보를 찾을 수 없습니다." };
  const { error } = await supabase.from("bus_check_records").upsert(
    {
      student_id: student.id,
      check_date: checkDate,
      bus_time_slot_id: busTimeSlotId,
      bus_number_id: busNumberId,
      boarded_at: new Date().toISOString(),
    },
    { onConflict: "student_id,check_date" }
  );
  if (error) {
    logger.error("[boardBusStudent]", error.message);
    return { error: error.message };
  }
  logger.info("[boardBusStudent]", "탑승 처리", { studentProfileId, checkDate });
  return {};
}

export async function unboardBusStudent(
  studentProfileId: string,
  checkDate: string
): Promise<{ error?: string }> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const student = await getStudentRecordByProfileId(supabase, studentProfileId);
  if (!student) return {};

  // 기존 레코드 확인
  const { data: record } = await supabase
    .from("bus_check_records")
    .select("id, checked_at")
    .eq("student_id", student.id)
    .eq("check_date", checkDate)
    .maybeSingle();

  if (!record) return {};

  // checked_at도 null이면 레코드 삭제 (불필요 레코드 정리)
  if (!record.checked_at) {
    const { error } = await supabase
      .from("bus_check_records")
      .delete()
      .eq("id", record.id);
    if (error) {
      logger.error("[unboardBusStudent]", error.message);
      return { error: error.message };
    }
  } else {
    // checked_at이 있으면 boarded_at만 null로
    const { error } = await supabase
      .from("bus_check_records")
      .update({ boarded_at: null })
      .eq("id", record.id);
    if (error) {
      logger.error("[unboardBusStudent]", error.message);
      return { error: error.message };
    }
  }

  return {};
}

// ── 하차 체크 ──

export async function checkBusStudent(
  studentProfileId: string,
  checkDate: string,
  busTimeSlotId: string,
  busNumberId: string,
  checkedBy: string
): Promise<{ error?: string }> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const student = await getStudentRecordByProfileId(supabase, studentProfileId);
  if (!student) return { error: "학생 정보를 찾을 수 없습니다." };
  const { error } = await supabase.from("bus_check_records").upsert(
    {
      student_id: student.id,
      check_date: checkDate,
      bus_time_slot_id: busTimeSlotId,
      bus_number_id: busNumberId,
      checked_at: new Date().toISOString(),
      checked_by: checkedBy,
    },
    { onConflict: "student_id,check_date" }
  );
  if (error) {
    logger.error("[checkBusStudent]", error.message);
    return { error: error.message };
  }
  logger.info("[checkBusStudent]", "하차 체크", { studentProfileId, checkDate });
  return {};
}

export async function uncheckBusStudent(
  studentProfileId: string,
  checkDate: string
): Promise<{ error?: string }> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const student = await getStudentRecordByProfileId(supabase, studentProfileId);
  if (!student) return {};

  // boarded_at이 있으면 checked_at만 null로 (탑승 상태로 복귀)
  // boarded_at도 없으면 레코드 삭제
  const { data: record } = await supabase
    .from("bus_check_records")
    .select("id, boarded_at")
    .eq("student_id", student.id)
    .eq("check_date", checkDate)
    .maybeSingle();

  if (!record) return {};

  if (record.boarded_at) {
    const { error } = await supabase
      .from("bus_check_records")
      .update({ checked_at: null, checked_by: null })
      .eq("id", record.id);
    if (error) {
      logger.error("[uncheckBusStudent]", error.message);
      return { error: error.message };
    }
  } else {
    const { error } = await supabase
      .from("bus_check_records")
      .delete()
      .eq("id", record.id);
    if (error) {
      logger.error("[uncheckBusStudent]", error.message);
      return { error: error.message };
    }
  }

  return {};
}

// ── 배치 탑승/하차 처리 ──

export async function batchBusCheckRecord(
  items: {
    action: "board" | "unboard" | "check" | "uncheck";
    studentProfileId: string;
    busTimeSlotId: string;
    busNumberId: string;
  }[],
  checkDate: string,
  checkedBy: string
): Promise<{ error?: string }> {
  const auth = await verifyAuthenticated();
  if ("error" in auth) return { error: auth.error };
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const studentRecords = await Promise.all(
    items.map((item) => getStudentRecordByProfileId(supabase, item.studentProfileId))
  );
  const normalized = items.flatMap((item, index) => {
    const student = studentRecords[index];
    if (!student) return [];
    return [{ ...item, studentId: student.id }];
  });

  const boardItems = normalized.filter((i) => i.action === "board");
  const checkItems = normalized.filter((i) => i.action === "check");
  const unboardItems = normalized.filter((i) => i.action === "unboard");
  const uncheckItems = normalized.filter((i) => i.action === "uncheck");

  // 탑승: 배치 upsert
  if (boardItems.length > 0) {
    const { error } = await supabase.from("bus_check_records").upsert(
      boardItems.map((i) => ({
        student_id: i.studentId,
        check_date: checkDate,
        bus_time_slot_id: i.busTimeSlotId,
        bus_number_id: i.busNumberId,
        boarded_at: now,
      })),
      { onConflict: "student_id,check_date" }
    );
    if (error) {
      logger.error("[batchBusCheckRecord:board]", error.message);
      return { error: error.message };
    }
  }

  // 하차: 배치 upsert
  if (checkItems.length > 0) {
    const { error } = await supabase.from("bus_check_records").upsert(
      checkItems.map((i) => ({
        student_id: i.studentId,
        check_date: checkDate,
        bus_time_slot_id: i.busTimeSlotId,
        bus_number_id: i.busNumberId,
        checked_at: now,
        checked_by: checkedBy,
      })),
      { onConflict: "student_id,check_date" }
    );
    if (error) {
      logger.error("[batchBusCheckRecord:check]", error.message);
      return { error: error.message };
    }
  }

  // 탑승 취소: UPDATE + 빈 레코드 삭제
  if (unboardItems.length > 0) {
    const ids = unboardItems.map((i) => i.studentId);
    const { error: unboardErr } = await supabase
      .from("bus_check_records")
      .update({ boarded_at: null })
      .eq("check_date", checkDate)
      .in("student_id", ids);
    if (unboardErr) {
      logger.error("[batchBusCheckRecord:unboard]", unboardErr.message);
      return { error: unboardErr.message };
    }
    const { error: unboardDelErr } = await supabase
      .from("bus_check_records")
      .delete()
      .eq("check_date", checkDate)
      .in("student_id", ids)
      .is("boarded_at", null)
      .is("checked_at", null);
    if (unboardDelErr) {
      logger.error("[batchBusCheckRecord:unboard:delete]", unboardDelErr.message);
      return { error: unboardDelErr.message };
    }
  }

  // 하차 취소: UPDATE + 빈 레코드 삭제
  if (uncheckItems.length > 0) {
    const ids = uncheckItems.map((i) => i.studentId);
    const { error: uncheckErr } = await supabase
      .from("bus_check_records")
      .update({ checked_at: null, checked_by: null })
      .eq("check_date", checkDate)
      .in("student_id", ids);
    if (uncheckErr) {
      logger.error("[batchBusCheckRecord:uncheck]", uncheckErr.message);
      return { error: uncheckErr.message };
    }
    const { error: uncheckDelErr } = await supabase
      .from("bus_check_records")
      .delete()
      .eq("check_date", checkDate)
      .in("student_id", ids)
      .is("boarded_at", null)
      .is("checked_at", null);
    if (uncheckDelErr) {
      logger.error("[batchBusCheckRecord:uncheck:delete]", uncheckDelErr.message);
      return { error: uncheckDelErr.message };
    }
  }

  logger.info("[batchBusCheckRecord]", "배치 처리 완료", {
    checkDate,
    board: boardItems.length,
    check: checkItems.length,
    unboard: unboardItems.length,
    uncheck: uncheckItems.length,
  });
  return {};
}

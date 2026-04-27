"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { buildStopToBusMaps } from "./_helpers";
import type {
  BusManifestGroup,
  BusManifestEntry,
  BusManifestExtraStop,
  NoRideEntry,
  AfterSchoolBusEntry,
} from "@/lib/types";

// ── 일일 매니페스트 (동승자 뷰) ──
//
// 읽기 전용 조합 쿼리 — 인증 검증 없이 호출 가능 (내부 페이지에서만 사용).
// mutation 없으므로 check:auth 대상 아님.

export async function getDailyBusManifest(
  date: string
): Promise<{ groups: BusManifestGroup[]; noRides: NoRideEntry[]; afterschoolStudents: AfterSchoolBusEntry[] }> {
  const supabase = createAdminClient();

  const d = new Date(date);
  const jsDay = d.getDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;

  // ── Phase 1: 4개 독립 쿼리 병렬 실행 ──
  const isWeekday = isoDay >= 1 && isoDay <= 5;

  const [
    { data: defaults },
    { data: changes },
    afterschoolEnrollments,
    stopBusMaps,
    { data: flaggedSlotsRaw },
  ] = await Promise.all([
    supabase
      .from("student_bus_defaults")
      .select("*")
      .eq("day_of_week", isoDay),
    supabase
      .from("bus_change_requests")
      .select("*")
      .eq("request_date", date)
      .eq("status", "approved"),
    isWeekday
      ? supabase
          .from("afterschool_enrollments")
          .select("student_profile_id")
          .eq("day_of_week", isoDay)
      : Promise.resolve({ data: null }),
    buildStopToBusMaps(supabase, isoDay),
    supabase
      .from("bus_time_slots")
      .select("id, label, time")
      .eq("is_active", true)
      .eq("show_empty_stops", true),
  ]);

  // 학생 배정 여부와 무관하게 정류장을 표시해야 하는 시간대 (오후반 등)
  const flaggedSlotIds = new Set<string>(
    (flaggedSlotsRaw ?? []).map((s) => s.id as string)
  );

  // 방과후 학생 ID 수집 (Phase 2에서 학생 정보 함께 조회)
  const enrolledIds = isWeekday && afterschoolEnrollments.data?.length
    ? [...new Set(afterschoolEnrollments.data.map((e) => e.student_profile_id))]
    : [];

  const defaultRows = defaults ?? [];
  const changeRows = changes ?? [];

  if (!defaultRows.length && !changeRows.length && flaggedSlotIds.size === 0) {
    // 방과후 학생만 있는 경우에도 조회 필요
    let afterschoolStudents: AfterSchoolBusEntry[] = [];
    if (enrolledIds.length) {
      const { data: students } = await supabase
        .from("students")
        .select("profile_id, korean_name, english_name, age")
        .in("profile_id", enrolledIds);
      afterschoolStudents = (students ?? []).map((s) => ({
        student_profile_id: s.profile_id,
        korean_name: s.korean_name,
        english_name: s.english_name,
        age: s.age ?? null,
      }));
    }
    return { groups: [], noRides: [], afterschoolStudents };
  }

  // ID 수집 (Phase 2 쿼리용)
  const allStudentIds = [
    ...new Set([
      ...defaultRows.map((d) => d.student_profile_id),
      ...changeRows.map((c) => c.student_profile_id),
    ]),
  ];
  const allSlotIds = [
    ...new Set([
      ...defaultRows.map((d) => d.bus_time_slot_id),
      ...changeRows.filter((c) => c.new_bus_time_slot_id).map((c) => c.new_bus_time_slot_id),
    ]),
  ];
  const changeStopIds = changeRows.filter((c) => c.new_bus_stop_id).map((c) => c.new_bus_stop_id);
  const allStopIds = [
    ...new Set([
      ...defaultRows.filter((r) => r.bus_stop_id).map((r) => r.bus_stop_id),
      ...changeStopIds,
    ]),
  ];
  // 방과후 학생 중 bus default에 없는 ID도 조회 대상에 포함
  const afterschoolOnlyIds = enrolledIds.filter((id) => !allStudentIds.includes(id));

  // ── Phase 2: 6개 독립 쿼리 병렬 실행 ──
  const [
    { data: studentsRaw },
    { data: afterschoolStudentsRaw },
    slotsResult,
    busesResult,
    { data: checkRecords },
    stopSchedulesResult,
    stopNamesResult,
  ] = await Promise.all([
    allStudentIds.length
      ? supabase
          .from("students")
          .select("profile_id, korean_name, english_name, student_number, age")
          .in("profile_id", allStudentIds)
      : Promise.resolve({ data: [] as { profile_id: string; korean_name: string; english_name: string; student_number: string; age: number | null }[] }),
    afterschoolOnlyIds.length
      ? supabase
          .from("students")
          .select("profile_id, korean_name, english_name, age")
          .in("profile_id", afterschoolOnlyIds)
      : Promise.resolve({ data: [] as { profile_id: string; korean_name: string; english_name: string; age: number | null }[] }),
    allSlotIds.length
      ? supabase.from("bus_time_slots").select("id, label, time").in("id", allSlotIds)
      : Promise.resolve({ data: [] as { id: string; label: string; time: string }[] }),
    supabase.from("bus_numbers").select("id, label").eq("is_active", true),
    supabase
      .from("bus_check_records")
      .select("id, student_profile_id, boarded_at, checked_at")
      .eq("check_date", date),
    allStopIds.length
      ? supabase
          .from("bus_stop_schedules")
          .select("bus_stop_id, estimated_time, bus_time_slot_id")
          .in("bus_stop_id", allStopIds)
          .eq("day_of_week", isoDay)
      : Promise.resolve({ data: [] as { bus_stop_id: string; estimated_time: string; bus_time_slot_id: string | null }[] }),
    allStopIds.length
      ? supabase.from("bus_stops").select("id, name").in("id", allStopIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  // ── 맵 구축 ──
  const studentMap = new Map(
    (studentsRaw ?? []).map((s) => [s.profile_id, s])
  );

  const slotMap = new Map(
    (slotsResult.data ?? []).map((s) => [s.id, { label: s.label, time: s.time }])
  );

  // bus_numbers 전체 조회 → busMap
  const allBuses = busesResult.data ?? [];
  const busMap = new Map(allBuses.map((b) => [b.id, b.label]));

  const checkMap = new Map(
    (checkRecords ?? []).map((r) => [r.student_profile_id, { boarded_at: r.boarded_at, checked_at: r.checked_at, id: r.id }])
  );

  // stopId -> slotId|"_" -> time
  const stopScheduleMap = new Map<string, Map<string, string>>();
  for (const ss of stopSchedulesResult.data ?? []) {
    if (!stopScheduleMap.has(ss.bus_stop_id)) stopScheduleMap.set(ss.bus_stop_id, new Map());
    const slotKey = ss.bus_time_slot_id ?? "_";
    stopScheduleMap.get(ss.bus_stop_id)!.set(slotKey, ss.estimated_time);
  }
  const stopNameMap = new Map((stopNamesResult.data ?? []).map((s) => [s.id, s.name]));

  // 방과후 학생 목록 조합
  let afterschoolStudents: AfterSchoolBusEntry[] = [];
  if (enrolledIds.length) {
    // bus default에 포함된 학생은 studentMap에서, 나머지는 afterschoolStudentsRaw에서
    afterschoolStudents = enrolledIds
      .map((id) => {
        const fromMain = studentMap.get(id);
        if (fromMain) return {
          student_profile_id: fromMain.profile_id,
          korean_name: fromMain.korean_name,
          english_name: fromMain.english_name,
          age: fromMain.age ?? null,
        };
        const fromAfter = (afterschoolStudentsRaw ?? []).find((s) => s.profile_id === id);
        if (fromAfter) return {
          student_profile_id: fromAfter.profile_id,
          korean_name: fromAfter.korean_name,
          english_name: fromAfter.english_name,
          age: fromAfter.age ?? null,
        };
        return null;
      })
      .filter((s): s is AfterSchoolBusEntry => s !== null);
  }

  // 정류장 시간 조회 헬퍼: 시간대 매칭 → fallback null 슬롯
  function getStopTime(stopId: string, slotId: string | null): string | null {
    const bySlot = stopScheduleMap.get(stopId);
    if (!bySlot) return null;
    // 시간대 매칭
    if (slotId) {
      const matched = bySlot.get(slotId);
      if (matched) return matched;
    }
    // fallback: slot=null 레코드
    return bySlot.get("_") ?? null;
  }

  function getSlotTime(slotId: string): string {
    return slotMap.get(slotId)?.time ?? "";
  }

  const changeMap = new Map(changeRows.map((c) => [c.student_profile_id, c]));
  type GroupBucket = {
    slotId: string;
    busId: string;
    students: BusManifestEntry[];
    takenStopIds: Set<string>;
    extraStops?: BusManifestExtraStop[];
  };
  const groupMap = new Map<string, GroupBucket>();
  const noRides: NoRideEntry[] = [];

  function ensureGroup(slotId: string, busId: string): GroupBucket {
    const key = `${slotId}-${busId}`;
    let group = groupMap.get(key);
    if (!group) {
      group = { slotId, busId, students: [], takenStopIds: new Set() };
      groupMap.set(key, group);
    }
    return group;
  }

  for (const def of defaultRows) {
    const student = studentMap.get(def.student_profile_id);
    if (!student) continue;

    const change = changeMap.get(def.student_profile_id);
    const check = checkMap.get(def.student_profile_id);

    // 호차 파생: stop→bus 매핑에서 시간대별로 결정
    const derivedBusId = def.bus_stop_id
      ? (stopBusMaps.getBySlot(def.bus_stop_id, def.bus_time_slot_id) ?? null)
      : null;

    if (change) {
      // 결석: new_bus_stop_id 유무와 관계없이 항상 원래 호차 그룹에 is_absent=true로 추가
      if (change.change_type === "absent") {
        if (derivedBusId) {
          const absentGroup = ensureGroup(def.bus_time_slot_id, derivedBusId);
          if (def.bus_stop_id) absentGroup.takenStopIds.add(def.bus_stop_id);
          const stopName = def.bus_stop_id ? stopNameMap.get(def.bus_stop_id) : undefined;
          const stopTime = def.bus_stop_id ? getStopTime(def.bus_stop_id, def.bus_time_slot_id) : undefined;
          absentGroup.students.push({
            student_profile_id: def.student_profile_id,
            korean_name: student.korean_name,
            english_name: student.english_name,
            student_number: student.student_number,
            age: student.age ?? null,
            is_changed: false,
            is_absent: true,
            estimated_time: stopTime ?? def.estimated_time,
            note: "결석",
            bus_stop_name: stopName ?? null,
            bus_stop_sort_order: def.bus_stop_id ? stopBusMaps.getSortOrder(def.bus_stop_id, def.bus_time_slot_id) : null,
            boarded_at: null,
            checked_at: null,
            check_record_id: null,
          });
        } else {
          noRides.push({
            student_profile_id: def.student_profile_id,
            korean_name: student.korean_name,
            english_name: student.english_name,
            student_number: student.student_number,
            original_slot_time: getSlotTime(def.bus_time_slot_id),
            original_bus_label: undefined,
            change_type: "absent",
            request_id: change.id,
          });
        }
        continue;
      }
      // 미탑승
      if (change.change_type === "no_ride" && !change.new_bus_stop_id) {
        noRides.push({
          student_profile_id: def.student_profile_id,
          korean_name: student.korean_name,
          english_name: student.english_name,
          student_number: student.student_number,
          original_slot_time: getSlotTime(def.bus_time_slot_id),
          original_bus_label: derivedBusId ? busMap.get(derivedBusId) : undefined,
          change_type: "no_ride",
          request_id: change.id,
        });
        continue;
      }
      // 변경: 새 정류장 → 파생 호차, 없으면 change에 지정된 호차
      const newStopId = change.new_bus_stop_id;
      const newSlotId = change.new_bus_time_slot_id ?? def.bus_time_slot_id;
      const newBusId = newStopId
        ? (stopBusMaps.getBySlot(newStopId, newSlotId) ?? change.new_bus_number_id ?? derivedBusId)
        : (change.new_bus_number_id ?? derivedBusId);
      if (!newBusId) continue; // 미배정 — 그룹에 넣지 않음
      const changedGroup = ensureGroup(newSlotId, newBusId);
      const effectiveStopId = newStopId ?? def.bus_stop_id;
      if (effectiveStopId) changedGroup.takenStopIds.add(effectiveStopId);
      const stopName = effectiveStopId ? stopNameMap.get(effectiveStopId) : undefined;
      const effectiveSlotId2 = change.new_bus_time_slot_id ?? def.bus_time_slot_id;
      const stopTime = newStopId
        ? getStopTime(newStopId, effectiveSlotId2)
        : (def.bus_stop_id ? getStopTime(def.bus_stop_id, effectiveSlotId2) : null);
      const estimatedTime = newStopId ? stopTime : (stopTime ?? def.estimated_time);
      changedGroup.students.push({
        student_profile_id: def.student_profile_id,
        korean_name: student.korean_name,
        english_name: student.english_name,
        student_number: student.student_number,
        age: student.age ?? null,
        is_changed: true,
        estimated_time: estimatedTime,
        note: change.reason || def.note,
        bus_stop_name: stopName ?? null,
        bus_stop_sort_order: effectiveStopId ? stopBusMaps.getSortOrder(effectiveStopId, newSlotId) : null,
        original_slot_time: getSlotTime(def.bus_time_slot_id),
        original_bus_label: derivedBusId ? busMap.get(derivedBusId) : undefined,
        boarded_at: check?.boarded_at ?? null,
        checked_at: check?.checked_at ?? null,
        check_record_id: check?.id ?? null,
      });
    } else {
      // 미배정(호차 파생 불가) → 미배정 그룹 처리하지 않고 건너뜀
      if (!derivedBusId) continue;
      const defaultGroup = ensureGroup(def.bus_time_slot_id, derivedBusId);
      if (def.bus_stop_id) defaultGroup.takenStopIds.add(def.bus_stop_id);
      const stopTime2 = def.bus_stop_id ? getStopTime(def.bus_stop_id, def.bus_time_slot_id) : undefined;
      const stopName2 = def.bus_stop_id ? stopNameMap.get(def.bus_stop_id) : undefined;
      defaultGroup.students.push({
        student_profile_id: def.student_profile_id,
        korean_name: student.korean_name,
        english_name: student.english_name,
        student_number: student.student_number,
        age: student.age ?? null,
        is_changed: false,
        estimated_time: stopTime2 ?? def.estimated_time,
        note: def.note,
        bus_stop_name: stopName2 ?? null,
        bus_stop_sort_order: def.bus_stop_id ? stopBusMaps.getSortOrder(def.bus_stop_id, def.bus_time_slot_id) : null,
        boarded_at: check?.boarded_at ?? null,
        checked_at: check?.checked_at ?? null,
        check_record_id: check?.id ?? null,
      });
    }
  }

  // ── Phase 3: show_empty_stops 시간대 보강 ──
  // 학생 배정 없는 호차·정류장도 카드/헤더로 노출. 오후반처럼 수시 변동 노선에서 사용.
  if (flaggedSlotIds.size > 0) {
    const flaggedSlotArr = [...flaggedSlotIds];

    const { data: allDayAssignments } = await supabase
      .from("bus_stop_day_assignments")
      .select("bus_stop_id, bus_number_id, bus_time_slot_id, sort_order")
      .eq("day_of_week", isoDay);
    const assignmentRows = allDayAssignments ?? [];

    // 누락된 정류장 이름·스케줄·시간대 정보 보강 로드
    const neededStopIds = new Set<string>();
    for (const row of assignmentRows) neededStopIds.add(row.bus_stop_id);
    const missingStopIds = [...neededStopIds].filter((id) => !stopNameMap.has(id));
    const missingSlotIds = flaggedSlotArr.filter((id) => !slotMap.has(id));

    const [
      extraStopNamesRes,
      extraStopSchedulesRes,
      extraSlotsRes,
    ] = await Promise.all([
      missingStopIds.length
        ? supabase.from("bus_stops").select("id, name").in("id", missingStopIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      missingStopIds.length
        ? supabase
            .from("bus_stop_schedules")
            .select("bus_stop_id, estimated_time, bus_time_slot_id")
            .in("bus_stop_id", missingStopIds)
            .eq("day_of_week", isoDay)
        : Promise.resolve({ data: [] as { bus_stop_id: string; estimated_time: string; bus_time_slot_id: string | null }[] }),
      missingSlotIds.length
        ? supabase.from("bus_time_slots").select("id, label, time").in("id", missingSlotIds)
        : Promise.resolve({ data: [] as { id: string; label: string; time: string }[] }),
    ]);

    for (const s of extraStopNamesRes.data ?? []) stopNameMap.set(s.id, s.name);
    for (const ss of extraStopSchedulesRes.data ?? []) {
      if (!stopScheduleMap.has(ss.bus_stop_id)) stopScheduleMap.set(ss.bus_stop_id, new Map());
      const slotKey = ss.bus_time_slot_id ?? "_";
      stopScheduleMap.get(ss.bus_stop_id)!.set(slotKey, ss.estimated_time);
    }
    for (const s of extraSlotsRes.data ?? []) slotMap.set(s.id, { label: s.label, time: s.time });

    // 각 flagged slot 에 대해 (stopId → busId) 를 slot-specific 우선, null fallback 으로 해석
    for (const slotId of flaggedSlotArr) {
      const resolved = new Map<string, { busId: string; sortOrder: number }>();
      // 1차: slot-specific
      for (const row of assignmentRows) {
        if (row.bus_time_slot_id === slotId) {
          resolved.set(row.bus_stop_id, {
            busId: row.bus_number_id,
            sortOrder: row.sort_order ?? 0,
          });
        }
      }
      // 2차: null fallback (slot-specific 이 없는 경우만)
      for (const row of assignmentRows) {
        if (row.bus_time_slot_id === null && !resolved.has(row.bus_stop_id)) {
          resolved.set(row.bus_stop_id, {
            busId: row.bus_number_id,
            sortOrder: row.sort_order ?? 0,
          });
        }
      }

      // busId 별로 정류장 리스트
      const byBus = new Map<string, { stopId: string; sortOrder: number }[]>();
      for (const [stopId, info] of resolved) {
        if (!byBus.has(info.busId)) byBus.set(info.busId, []);
        byBus.get(info.busId)!.push({ stopId, sortOrder: info.sortOrder });
      }

      for (const [busId, stops] of byBus) {
        const group = ensureGroup(slotId, busId);
        const extras: BusManifestExtraStop[] = [];
        for (const s of stops) {
          if (group.takenStopIds.has(s.stopId)) continue;
          const name = stopNameMap.get(s.stopId);
          if (!name) continue;
          const time = getStopTime(s.stopId, slotId);
          extras.push({
            bus_stop_id: s.stopId,
            bus_stop_name: name,
            bus_stop_sort_order: s.sortOrder,
            estimated_time: time,
          });
        }
        if (extras.length) {
          extras.sort((a, b) => {
            const orderA = a.bus_stop_sort_order ?? Number.MAX_SAFE_INTEGER;
            const orderB = b.bus_stop_sort_order ?? Number.MAX_SAFE_INTEGER;
            if (orderA !== orderB) return orderA - orderB;
            const timeA = a.estimated_time ?? "99:99";
            const timeB = b.estimated_time ?? "99:99";
            if (timeA !== timeB) return timeA.localeCompare(timeB);
            return a.bus_stop_name.localeCompare(b.bus_stop_name);
          });
          group.extraStops = extras;
        }
      }
    }
  }

  const groups: BusManifestGroup[] = [...groupMap.values()]
    .map((g) => ({
      bus_time_slot_id: g.slotId,
      slot_time: getSlotTime(g.slotId),
      slot_label: slotMap.get(g.slotId)?.label ?? "",
      bus_number_id: g.busId,
      bus_label: busMap.get(g.busId) ?? "",
      students: g.students,
      extra_stops: g.extraStops?.length ? g.extraStops : undefined,
    }))
    .sort((a, b) => {
      const timeCmp = a.slot_time.localeCompare(b.slot_time);
      if (timeCmp !== 0) return timeCmp;
      return a.bus_label.localeCompare(b.bus_label);
    });

  return { groups, noRides, afterschoolStudents };
}

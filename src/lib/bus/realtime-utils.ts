import type { BusManifestGroup, BusManifestEntry, NoRideEntry } from "@/lib/types";

export type CheckRecordRow = {
  student_profile_id: string;
  boarded_at: string | null;
  checked_at: string | null;
  check_date: string;
};

export type ChangeRequestRow = {
  id: string;
  student_profile_id: string;
  change_type: "absent" | "no_ride" | "change";
  new_bus_number_id: string | null;
  new_bus_time_slot_id: string | null;
  new_bus_stop_id: string | null;
  request_date: string;
  status: string;
};

/** bus_check_records INSERT/UPDATE/DELETE → 해당 학생의 boarded_at/checked_at 패치 */
export function applyCheckRecord(
  groups: BusManifestGroup[],
  event: "INSERT" | "UPDATE" | "DELETE",
  row: CheckRecordRow
): BusManifestGroup[] {
  return groups.map((g) => ({
    ...g,
    students: g.students.map((s) => {
      if (s.student_profile_id !== row.student_profile_id) return s;
      if (event === "DELETE") return { ...s, boarded_at: null, checked_at: null };
      return { ...s, boarded_at: row.boarded_at, checked_at: row.checked_at };
    }),
  }));
}

/** bus_change_requests INSERT/UPDATE → 그룹 구조 패치 */
export function applyChangeRequest(
  groups: BusManifestGroup[],
  noRides: NoRideEntry[],
  event: "INSERT" | "UPDATE" | "DELETE",
  row: ChangeRequestRow
): { groups: BusManifestGroup[]; noRides: NoRideEntry[] } {
  // DELETE는 호출자가 refetch로 처리
  if (event === "DELETE") {
    return { groups, noRides };
  }

  const sid = row.student_profile_id;

  // absent: 그룹 내 is_absent 플래그 토글만 (그룹 구조 불변)
  if (row.change_type === "absent") {
    return {
      groups: groups.map((g) => ({
        ...g,
        students: g.students.map((s) =>
          s.student_profile_id === sid ? { ...s, is_absent: true } : s
        ),
      })),
      noRides: noRides.filter((r) => r.student_profile_id !== sid),
    };
  }

  // no_ride / change: 현재 그룹에서 학생 제거 → noRides 추가
  let student: BusManifestEntry | null = null;
  let originalBusLabel: string | undefined;

  const newGroups = groups.map((g) => {
    const found = g.students.find((s) => s.student_profile_id === sid);
    if (found) {
      student = found;
      originalBusLabel = g.bus_label;
    }
    return { ...g, students: g.students.filter((s) => s.student_profile_id !== sid) };
  });

  const noRideEntry: NoRideEntry = student
    ? {
        student_profile_id: sid,
        korean_name: (student as BusManifestEntry).korean_name,
        english_name: (student as BusManifestEntry).english_name,
        student_number: (student as BusManifestEntry).student_number,
        original_bus_label: originalBusLabel,
        change_type: "no_ride",
      }
    : (noRides.find((r) => r.student_profile_id === sid) ?? {
        student_profile_id: sid,
        korean_name: null,
        english_name: null,
        student_number: null,
        change_type: "no_ride",
      });

  return {
    groups: newGroups,
    noRides: [
      ...noRides.filter((r) => r.student_profile_id !== sid),
      noRideEntry,
    ],
  };
}

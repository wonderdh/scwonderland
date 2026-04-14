import type {
  ReservationAttendance,
  ReservationBusChange,
} from "@/app/(admin)/admin/actions/reservation-actions";

export type ReservationGroup<T> = {
  items: T[];
  startDate: string;
  endDate: string;
  count: number;
};

function parseYmd(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+09:00`);
}

/**
 * 다음 평일 확인: 금요일이면 월요일까지도 "연속"으로 취급.
 * (MultiDatePicker가 주말을 자동 제외하므로 주말 스킵을 허용.)
 */
function isNextBusinessDay(prev: string, curr: string): boolean {
  const p = parseYmd(prev);
  const c = parseYmd(curr);
  const diff = Math.round((c.getTime() - p.getTime()) / 86_400_000);
  if (diff === 1) return true;
  const prevDow = p.getUTCDay(); // KST midnight → getUTCDay gives KST weekday
  // 금요일(5) → 월요일(diff=3), 토요일이 끼면 건너뛰기
  if (prevDow === 5 && diff === 3) return true;
  return false;
}

function groupBy<T>(
  items: T[],
  getDate: (item: T) => string,
  getKey: (item: T) => string,
): ReservationGroup<T>[] {
  if (items.length === 0) return [];

  // 1) 같은 key(학생·상태 등)끼리 먼저 모으고 날짜 오름차순 정렬
  const byKey = new Map<string, T[]>();
  for (const it of items) {
    const k = getKey(it);
    const arr = byKey.get(k) ?? [];
    arr.push(it);
    byKey.set(k, arr);
  }

  // 2) 각 key 그룹 내에서 연속 날짜로 쪼개기
  const groups: ReservationGroup<T>[] = [];
  for (const arr of byKey.values()) {
    arr.sort((a, b) => getDate(a).localeCompare(getDate(b)));
    let current: T[] = [arr[0]];
    for (let i = 1; i < arr.length; i++) {
      const prev = current[current.length - 1];
      const item = arr[i];
      if (isNextBusinessDay(getDate(prev), getDate(item))) {
        current.push(item);
      } else {
        groups.push(buildGroup(current, getDate));
        current = [item];
      }
    }
    groups.push(buildGroup(current, getDate));
  }

  // 3) 최종 출력은 startDate 오름차순
  groups.sort((a, b) => a.startDate.localeCompare(b.startDate));
  return groups;
}

function buildGroup<T>(
  items: T[],
  getDate: (item: T) => string,
): ReservationGroup<T> {
  return {
    items,
    startDate: getDate(items[0]),
    endDate: getDate(items[items.length - 1]),
    count: items.length,
  };
}

export function groupAttendanceReservations(
  items: ReservationAttendance[],
): ReservationGroup<ReservationAttendance>[] {
  return groupBy(
    items,
    (a) => a.attendance_date,
    (a) => `${a.student_profile_id}|${a.status}|${a.note ?? ""}`,
  );
}

export function groupBusReservations(
  items: ReservationBusChange[],
): ReservationGroup<ReservationBusChange>[] {
  return groupBy(
    items,
    (b) => b.request_date,
    (b) =>
      [
        b.student_profile_id,
        b.change_type,
        b.new_bus_number_label ?? "",
        b.new_bus_time_slot_label ?? "",
        b.reason ?? "",
      ].join("|"),
  );
}

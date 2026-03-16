import type { BusManifestEntry } from "@/lib/types";

export type StopGroup = {
  stopName: string;
  estimatedTime: string | null;
  students: BusManifestEntry[];
};

/**
 * 학생 목록을 정류장별로 그룹핑한다.
 * 정렬 기준: bus_stop_sort_order → estimated_time → bus_stop_name (오름차순)
 * 그룹 내 학생: 나이순 → 이름순
 */
export function groupStudentsByStop(students: BusManifestEntry[]): StopGroup[] {
  const sorted = [...students].sort((a, b) => {
    // 정류장 배치 순서 우선
    const sa = a.bus_stop_sort_order ?? 9999;
    const sb = b.bus_stop_sort_order ?? 9999;
    if (sa !== sb) return sa - sb;
    // fallback: 예상 시간 → 이름순
    const ta = a.estimated_time ?? "99:99";
    const tb = b.estimated_time ?? "99:99";
    if (ta !== tb) return ta.localeCompare(tb);
    return (a.bus_stop_name ?? "").localeCompare(b.bus_stop_name ?? "");
  });

  const groups: StopGroup[] = [];
  let current: StopGroup | null = null;

  for (const s of sorted) {
    const key = `${s.bus_stop_name ?? ""}|${s.estimated_time ?? ""}`;
    if (!current || `${current.stopName}|${current.estimatedTime ?? ""}` !== key) {
      current = {
        stopName: s.bus_stop_name ?? "",
        estimatedTime: s.estimated_time ?? null,
        students: [],
      };
      groups.push(current);
    }
    current.students.push(s);
  }

  // 그룹 내 학생: 나이순 → 이름순
  for (const g of groups) {
    g.students.sort((a, b) => {
      const ageA = a.age ?? 99;
      const ageB = b.age ?? 99;
      if (ageA !== ageB) return ageA - ageB;
      return (a.korean_name ?? a.english_name ?? "").localeCompare(
        b.korean_name ?? b.english_name ?? ""
      );
    });
  }

  return groups;
}

/** HH:MM:SS → HH:MM */
export function formatTime(t: string): string {
  return t.slice(0, 5);
}

/** ISO timestamp → H:MM */
export function formatCheckedTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}`;
}

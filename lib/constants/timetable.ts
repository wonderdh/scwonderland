import type { StudentTimetableRow } from "@/lib/types";

/**
 * 교사별 색상 팔레트 (시간표 표시용).
 * StudentTimetableClient + StudentTimetableTab 등에서 공유.
 * Tailwind 동적 클래스 금지 규칙에 따라 완전한 리터럴만 사용.
 */
export const TEACHER_COLOR_PALETTE: readonly { bg: string; text: string }[] = [
  { bg: "bg-blue-200", text: "text-blue-800" },
  { bg: "bg-emerald-200", text: "text-emerald-800" },
  { bg: "bg-violet-200", text: "text-violet-800" },
  { bg: "bg-rose-200", text: "text-rose-800" },
  { bg: "bg-amber-200", text: "text-amber-800" },
  { bg: "bg-cyan-200", text: "text-cyan-800" },
  { bg: "bg-pink-200", text: "text-pink-800" },
  { bg: "bg-orange-200", text: "text-orange-800" },
  { bg: "bg-teal-200", text: "text-teal-800" },
  { bg: "bg-indigo-200", text: "text-indigo-800" },
  { bg: "bg-lime-200", text: "text-lime-800" },
  { bg: "bg-sky-200", text: "text-sky-800" },
];

/** 시간표 행에서 교사 ID → 색상 매핑을 빌드 */
export function buildTeacherColorMap(
  rows: StudentTimetableRow[],
): Map<string, { bg: string; text: string }> {
  const seen = new Map<string, string>(); // id → name
  for (const row of rows) {
    for (const cell of Object.values(row.cells)) {
      if (
        cell?.teacher_profile_id &&
        cell.teacher_name &&
        !seen.has(cell.teacher_profile_id)
      ) {
        seen.set(cell.teacher_profile_id, cell.teacher_name);
      }
    }
  }
  const sorted = [...seen.entries()].sort((a, b) =>
    a[1].localeCompare(b[1]),
  );
  const map = new Map<string, { bg: string; text: string }>();
  sorted.forEach(([id], i) => {
    map.set(
      id,
      TEACHER_COLOR_PALETTE[i % TEACHER_COLOR_PALETTE.length],
    );
  });
  return map;
}

import { todayKst } from "@/lib/utils/date-kst";

/**
 * 관리자가 설정한 기준점(base)으로부터 현재 주차를 계산.
 * - baseWeek: "이 일요일(baseSunday)에 N주차였다"
 * - 이후 매주 일요일마다 +1, 48주 순환
 */
export function computeAutoWeekNumber(
  baseWeek: number,
  baseSunday: string,
  today: string = todayKst(),
): number {
  const start = new Date(`${baseSunday}T00:00:00+09:00`);
  const cur = new Date(`${today}T00:00:00+09:00`);
  const diffDays = Math.floor(
    (cur.getTime() - start.getTime()) / 86_400_000,
  );
  if (diffDays < 0) return baseWeek;
  const weeksSinceBase = Math.floor(diffDays / 7);
  return ((baseWeek - 1 + weeksSinceBase) % 48) + 1;
}

/** KST 기준 이번 주 일요일 날짜 (YYYY-MM-DD) */
export function getCurrentSunday(today: string = todayKst()): string {
  const d = new Date(`${today}T00:00:00+09:00`);
  const day = d.getDay(); // 0=일, 1=월, ...
  d.setDate(d.getDate() - day);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

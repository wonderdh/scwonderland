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

/**
 * KST 기준 이번 주 일요일 날짜 (YYYY-MM-DD).
 *
 * `today` 는 이미 KST 로 계산된 "YYYY-MM-DD" 이므로, 여기서는 UTC 로만 일관되게
 * 계산해야 서버 타임존(UTC 등)에 영향받지 않는다.
 * (이전 구현은 `+09:00` 으로 만든 인스턴트에 로컬 getter 를 섞어, UTC 서버에서
 *  일요일 입력 시 한 주 전 일요일을 반환하는 버그가 있었다.)
 */
export function getCurrentSunday(today: string = todayKst()): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // 0=일
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

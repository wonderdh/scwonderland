import { todayKst } from "@/lib/utils/date-kst";

/** 이번 주의 문장 Week 1 시작일 (KST 일요일). */
export const WEEK1_START_KST = "2026-04-05";

/**
 * KST 기준 현재 주차(1~52).
 * - 기준일 이전 → 1 (아직 시작 안 함)
 * - 기준일 이후 → (경과 주) + 1
 * - 52주 경과 시 mod 52로 순환
 */
export function computeAutoWeekNumber(today: string = todayKst()): number {
  const start = new Date(`${WEEK1_START_KST}T00:00:00+09:00`);
  const cur = new Date(`${today}T00:00:00+09:00`);
  const diffDays = Math.floor(
    (cur.getTime() - start.getTime()) / 86_400_000,
  );
  if (diffDays < 0) return 1;
  return (Math.floor(diffDays / 7) % 52) + 1;
}

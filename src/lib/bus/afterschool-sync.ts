/**
 * 하원 버스 슬롯 변경 시 방과후 enrollment와 동기화하는 유틸
 * StudentBusTab과 AdminBusChangeDnD 양쪽에서 공유
 *
 * 방과후 1차/2차는 수업 시간표(academy_periods)가 아니라 하원 시각으로 판정한다.
 *   - 하원 15:30 → 방과후 1차(1교시)
 *   - 하원 16:20 → 방과후 2차(2교시)
 * 방과후 시간은 별도 관리하지 않으며 변경 빈도가 거의 없어 상수로 고정한다.
 */

import type { BusTimeSlot } from "@/lib/types/database";

/** 방과후 하원 시각 상수 (HH:MM) */
export const AFTERSCHOOL_DISMISS_TIME_1 = "15:30" as const; // 방과후 1차
export const AFTERSCHOOL_DISMISS_TIME_2 = "16:20" as const; // 방과후 2차

/** "15:30" / "15:30:00" 등 어떤 포맷이 와도 HH:MM 으로 정규화 */
function toHhmm(time: string | undefined | null): string {
  return (time ?? "").slice(0, 5);
}

/**
 * 버스 슬롯이 방과후 슬롯인지, 2교시 여부를 반환 (하원 시각 기준)
 */
export function detectAfterschoolSlot(slot: BusTimeSlot | undefined): {
  isAfterschoolSlot: boolean;
  secondPeriod: boolean;
} {
  if (!slot) return { isAfterschoolSlot: false, secondPeriod: false };
  const t = toHhmm(slot.time);
  const isFirst = t === AFTERSCHOOL_DISMISS_TIME_1;
  const isSecond = t === AFTERSCHOOL_DISMISS_TIME_2;
  return {
    isAfterschoolSlot: isFirst || isSecond,
    secondPeriod: isSecond,
  };
}

/**
 * 방과후 1차/2차 하원 슬롯 id 조회 (하원 시각 기준).
 * 해당 시각 슬롯이 없으면 빈 문자열.
 */
export function findAfterschoolSlotIds(slots: BusTimeSlot[]): {
  firstSlotId: string;
  secondSlotId: string;
} {
  return {
    firstSlotId: slots.find((s) => toHhmm(s.time) === AFTERSCHOOL_DISMISS_TIME_1)?.id ?? "",
    secondSlotId: slots.find((s) => toHhmm(s.time) === AFTERSCHOOL_DISMISS_TIME_2)?.id ?? "",
  };
}

/**
 * 하원 버스 슬롯 변경 시 방과후 enrollment와 동기화하는 유틸
 * StudentBusTab과 AdminBusChangeDnD 양쪽에서 공유
 */

import type { BusTimeSlot } from "@/lib/types/database";

/** 방과후 슬롯 레이블 상수 */
export const AFTERSCHOOL_SLOT_LABEL_1 = "방과후1차" as const;
export const AFTERSCHOOL_SLOT_LABEL_2 = "오후반 1차/방과후2차" as const;

/**
 * 버스 슬롯이 방과후 슬롯인지, 2교시 여부를 반환
 */
export function detectAfterschoolSlot(slot: BusTimeSlot | undefined): {
  isAfterschoolSlot: boolean;
  secondPeriod: boolean;
} {
  if (!slot) return { isAfterschoolSlot: false, secondPeriod: false };
  const isSlot1 = slot.label === AFTERSCHOOL_SLOT_LABEL_1;
  const isSlot2 = slot.label === AFTERSCHOOL_SLOT_LABEL_2;
  return {
    isAfterschoolSlot: isSlot1 || isSlot2,
    secondPeriod: isSlot2,
  };
}

"use server";

import type { BusStaffProfile } from "@/lib/types";

// 신 스키마에서 bus_staff 테이블과 user_role "bus" 가 제거되어 비활성화 상태.
// 도메인 재도입 결정 시 복원.
export async function getCurrentBusStaffProfile(): Promise<BusStaffProfile | null> {
  return null;
}

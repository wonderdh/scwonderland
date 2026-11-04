/**
 * 출결 상태 공유 상수.
 * 모든 출결 UI(관리자/모바일/교사/학생/예약)에서 이 단일 소스를 import한다.
 * 새 상태 추가 시 이 파일만 수정하면 전 UI에 반영됨.
 */

import { Check, X, Clock, LogOut } from "lucide-react";
import type { ComponentType } from "react";

export const ATTENDANCE_STATUSES = [
  "present",
  "absent",
  "late",
  "early_leave",
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_STATUS_CONFIG: Record<
  AttendanceStatus,
  {
    label: string;
    labelEn: string;
    activeClass: string;
    inactiveClass: string;
    badgeClass: string;
    icon: ComponentType<{ className?: string }>;
  }
> = {
  present: {
    label: "출석",
    labelEn: "Present",
    activeClass:
      "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-400",
    inactiveClass: "bg-gray-100 text-gray-500 hover:bg-emerald-50",
    badgeClass: "bg-emerald-100 text-emerald-700",
    icon: Check,
  },
  absent: {
    label: "결석",
    labelEn: "Absent",
    activeClass: "bg-red-100 text-red-700 ring-2 ring-red-400",
    inactiveClass: "bg-gray-100 text-gray-500 hover:bg-red-50",
    badgeClass: "bg-red-100 text-red-700",
    icon: X,
  },
  late: {
    label: "지각",
    labelEn: "Late",
    activeClass: "bg-amber-100 text-amber-700 ring-2 ring-amber-400",
    inactiveClass: "bg-gray-100 text-gray-500 hover:bg-amber-50",
    badgeClass: "bg-amber-100 text-amber-700",
    icon: Clock,
  },
  early_leave: {
    label: "조퇴",
    labelEn: "Early Leave",
    activeClass:
      "bg-purple-100 text-purple-700 ring-2 ring-purple-400",
    inactiveClass: "bg-gray-100 text-gray-500 hover:bg-purple-50",
    badgeClass: "bg-purple-100 text-purple-700",
    icon: LogOut,
  },
};

/** 메모 입력을 보여줄 상태인지 (결석, 조퇴, 지각) */
export function shouldShowNote(status: string | null): boolean {
  return (
    status === "absent" ||
    status === "early_leave" ||
    status === "late"
  );
}

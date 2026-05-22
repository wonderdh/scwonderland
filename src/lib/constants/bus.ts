import { Hourglass, Check, X } from "lucide-react";
import type { ComponentType } from "react";
import type { BusChangeType, BusRequestStatus } from "@/lib/bus/state";

/** 버스 운행 요일 (월~금). admin bus 화면들이 공유. */
export const BUS_WEEKDAYS = [
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
] as const;

export const BUS_REQUEST_STATUS_CONFIG: Record<BusRequestStatus, {
  label: string;
  icon: ComponentType<{ className?: string }>;
  badgeClass: string;
  ariaLabel: string;
}> = {
  pending:  { label: "대기",   icon: Hourglass, badgeClass: "bg-amber-100 text-amber-800 border border-amber-300",     ariaLabel: "대기 중" },
  approved: { label: "승인",   icon: Check,     badgeClass: "bg-emerald-100 text-emerald-800 border border-emerald-300", ariaLabel: "승인됨" },
  rejected: { label: "거부",   icon: X,         badgeClass: "bg-red-100 text-red-800 border border-red-300",           ariaLabel: "거부됨" },
};

export const BUS_CHANGE_TYPE_CONFIG: Record<BusChangeType, {
  label: string;
  icon: ComponentType<{ className?: string }>;
  badgeClass: string;
}> = {
  change:           { label: "변경",     icon: Check,     badgeClass: "bg-blue-100 text-blue-800 border border-blue-300" },
  no_ride:          { label: "미탑승",   icon: X,         badgeClass: "bg-orange-100 text-orange-800 border border-orange-300" },
  absent:           { label: "결석",     icon: X,         badgeClass: "bg-red-100 text-red-800 border border-red-300" },
  temporary_change: { label: "임시변경", icon: Check,     badgeClass: "bg-purple-100 text-purple-800 border border-purple-300" },
};

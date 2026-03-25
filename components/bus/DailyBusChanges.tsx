"use client";

import { useState, useEffect, useCallback } from "react";
import type { BusChangeRequest } from "@/lib/types";
import { listChangeRequestsByDate } from "@/app/(admin)/admin/actions";
import { useBusRealtime } from "@/lib/hooks/use-bus-realtime";

const CHANGE_TYPE_CONFIG = {
  absent: { label: "결석", bg: "bg-red-100 text-red-700" },
  no_ride: { label: "픽업", bg: "bg-orange-100 text-orange-700" },
  change: { label: "호차변경", bg: "bg-blue-100 text-blue-700" },
} as const;

/** 결석은 등/하원 중복 제거 (1건만 표시) */
function deduplicateAbsent(list: BusChangeRequest[]): BusChangeRequest[] {
  const seen = new Set<string>();
  return list.filter((ch) => {
    if (ch.change_type !== "absent") return true;
    if (seen.has(ch.student_profile_id)) return false;
    seen.add(ch.student_profile_id);
    return true;
  });
}

function getLocalToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function DailyBusChanges() {
  const today = getLocalToday();
  const [changes, setChanges] = useState<BusChangeRequest[]>([]);

  const loadChanges = useCallback(() => {
    listChangeRequestsByDate(today)
      .then((result) => {
        setChanges(deduplicateAbsent(result));
      })
      .catch((err) => {
        console.error("[DailyBusChanges] loadChanges error:", err);
      });
  }, [today]);

  useEffect(() => {
    loadChanges();
  }, [loadChanges]);

  useBusRealtime(today, {
    onCheckRecord: () => {},
    onChangeRequest: () => {
      loadChanges();
    },
  });

  if (changes.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold text-foreground">당일 버스 변경사항</span>
        <span className="text-xs text-muted-foreground">{changes.length}건</span>
      </div>
      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
        {changes.map((ch) => {
          const name = ch.korean_name || ch.english_name || "이름 없음";
          const cfg = CHANGE_TYPE_CONFIG[ch.change_type] ?? CHANGE_TYPE_CONFIG.change;
          const dir = ch.direction === "pickup" ? "등원" : "하원";

          const newSlotTime = ch.new_time_slot_time ? ch.new_time_slot_time.slice(0, 5) : "";
          const newSlotLabel = ch.new_time_slot_label ?? "";
          const newBus = ch.change_type === "change" ? (ch.new_bus_label ?? "") : "";
          const origSlotTime = ch.orig_time_slot_time ? ch.orig_time_slot_time.slice(0, 5) : "";
          const origSlotLabel = ch.orig_time_slot_label ?? "";
          const origBus = ch.orig_bus_label ?? "";
          const origStop = ch.orig_bus_stop_name ?? "";
          const reason = ch.reason ?? "";
          const dateLabel = formatDate(String(ch.request_date));

          // 기존 일정 문자열
          const origParts = [origSlotTime, origSlotLabel, origBus, origStop].filter(Boolean);
          const origText = origParts.length > 0 ? origParts.join(" ") : "";
          // 변경 일정 문자열
          const newParts = [newSlotTime, newSlotLabel, newBus].filter(Boolean);
          const newText = newParts.length > 0 ? newParts.join(" ") : "";

          return (
            <div key={ch.id} className="px-4 py-2.5 flex items-center gap-2 text-sm">
              <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.bg}`}>
                {cfg.label}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">{dateLabel}</span>
              <span className="font-medium text-foreground truncate">{name}</span>
              {ch.change_type !== "absent" && (
                <span className="text-muted-foreground shrink-0">{dir}</span>
              )}
              {/* PC: 기존→변경 표시 */}
              {origText && (
                <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
                  <span className="opacity-60">{origText}</span>
                  {ch.change_type !== "absent" && newText && (
                    <span className="ml-1">→ {newText}</span>
                  )}
                </span>
              )}
              {/* 기존 일정 없을 때 변경 일정만 표시 */}
              {!origText && newText && ch.change_type !== "absent" && (
                <span className="text-xs tabular-nums text-muted-foreground shrink-0 hidden sm:inline">
                  {newText}
                </span>
              )}
              {/* 모바일: 간단 표시 */}
              {newText && ch.change_type !== "absent" && (
                <span className="text-xs tabular-nums text-muted-foreground shrink-0 sm:hidden">
                  {newSlotTime}{newSlotLabel ? ` ${newSlotLabel}` : ""}
                </span>
              )}
              {reason && (
                <span className="text-xs text-muted-foreground truncate hidden sm:inline">({reason})</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CheckRecordRow, ChangeRequestRow } from "@/lib/bus/realtime-utils";

export type { CheckRecordRow, ChangeRequestRow };

export function useBusRealtime(
  date: string,
  callbacks: {
    onCheckRecord: (event: "INSERT" | "UPDATE" | "DELETE", row: CheckRecordRow) => void;
    onChangeRequest: (event: "INSERT" | "UPDATE" | "DELETE", row: ChangeRequestRow) => void;
  },
  options?: { enabled?: boolean }
) {
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  });
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!date || !enabled) return;
    const supabase = createClient();

    const checkChannel = supabase
      .channel(`bus-checks-${date}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bus_check_records",
          filter: `check_date=eq.${date}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as CheckRecordRow;
          if (row.check_date && String(row.check_date) !== date) return;
          callbacksRef.current.onCheckRecord(payload.eventType, row);
        }
      )
      .subscribe();

    const changeChannel = supabase
      .channel(`bus-changes-${date}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bus_change_requests",
          filter: `request_date=eq.${date}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as ChangeRequestRow;
          if (row.request_date && String(row.request_date) !== date) return;
          callbacksRef.current.onChangeRequest(payload.eventType, row);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(checkChannel);
      supabase.removeChannel(changeChannel);
    };
  }, [date, enabled]);
}

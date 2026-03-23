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
  callbacksRef.current = callbacks;
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!date || !enabled) return;
    const supabase = createClient();

    // 컬럼 필터 제거: UPSERT INSERT 이벤트가 서버 필터에서 누락되는 문제 방지
    // 대신 클라이언트에서 날짜 필터링
    const checkChannel = supabase
      .channel(`bus-checks-${date}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bus_check_records",
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as CheckRecordRow;
          // 클라이언트 필터: 다른 날짜 이벤트 무시
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

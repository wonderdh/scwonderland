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
    // realtime-js v2.105+ 는 같은 topic 의 channel 을 재사용한다. StrictMode
    // 더블 이펙트나 빠른 재마운트 시 cleanup 의 removeChannel 이 끝나기 전에
    // 다음 effect 가 같은 topic 으로 .channel() 을 호출하면 이미 subscribe 된
    // 기존 채널을 반환받아 .on() 호출이 실패한다. 마운트별 유니크 suffix 로 회피.
    const uid = Math.random().toString(36).slice(2, 10);

    const checkChannel = supabase
      .channel(`bus-checks-${date}-${uid}`)
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
      .channel(`bus-changes-${date}-${uid}`)
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

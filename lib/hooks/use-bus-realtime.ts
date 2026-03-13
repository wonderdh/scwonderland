"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export function useBusRealtime(date: string, onUpdate: () => void) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`bus-realtime-${date}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bus_check_records",
          filter: `check_date=eq.${date}`,
        },
        () => {
          clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => onUpdateRef.current(), 500);
        }
      )
      .subscribe();

    return () => {
      clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [date]);
}

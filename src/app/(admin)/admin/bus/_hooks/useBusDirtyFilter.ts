"use client";

import { useCallback, useMemo, useState } from "react";

export type StopAssignment = { busNumberId: string; sortOrder: number };

type FilterChangeConfirm = { open: boolean; setter?: () => void };

/**
 * BusStopAssignmentManager 의 dirty state + 필터 가드.
 *
 * - `dayAssignments` / `serverAssignments` (키→{busNumberId, sortOrder}) 와
 *   `scheduleMap` / `serverSchedules` (키→시간) 4개 Map 을 묶어 관리.
 *   키 형식은 컴포넌트가 정한다 (한 정류장이 여러 호차에 들어가므로 `정류장|호차`, `요일|정류장|호차` 등).
 * - 미저장 변경이 있을 때 요일/시간대 필터 변경을 confirm dialog 로 가드.
 * - confirm 시 local → server 로 롤백 후 보류된 setter 실행.
 *
 * 컴포넌트는 fetch 후 `setDay*` + `setServer*` 둘 다 호출하고,
 * DnD/편집은 `setDayAssignments` / `setScheduleMap` 만 호출 (server* 는 저장 후 갱신).
 */
export function useBusDirtyFilter() {
  const [dayAssignments, setDayAssignments] = useState<Map<string, StopAssignment>>(new Map());
  const [serverAssignments, setServerAssignments] = useState<Map<string, StopAssignment>>(new Map());
  const [scheduleMap, setScheduleMap] = useState<Map<string, string>>(new Map());
  const [serverSchedules, setServerSchedules] = useState<Map<string, string>>(new Map());
  const [filterChangeConfirm, setFilterChangeConfirm] = useState<FilterChangeConfirm>({ open: false });

  const hasChanges = useMemo(() => {
    const allIds = new Set([...dayAssignments.keys(), ...serverAssignments.keys()]);
    for (const id of allIds) {
      const local = dayAssignments.get(id);
      const server = serverAssignments.get(id);
      if (!local && server) return true;
      if (local && !server) return true;
      if (local && server && (local.busNumberId !== server.busNumberId || local.sortOrder !== server.sortOrder)) return true;
    }
    const allSchedIds = new Set([...scheduleMap.keys(), ...serverSchedules.keys()]);
    for (const id of allSchedIds) {
      if ((scheduleMap.get(id) ?? "") !== (serverSchedules.get(id) ?? "")) return true;
    }
    return false;
  }, [dayAssignments, serverAssignments, scheduleMap, serverSchedules]);

  const guardFilterChange = useCallback((setter: () => void) => {
    if (hasChanges) {
      setFilterChangeConfirm({ open: true, setter });
      return;
    }
    setter();
  }, [hasChanges]);

  const confirmFilterChange = useCallback(() => {
    const setter = filterChangeConfirm.setter;
    setFilterChangeConfirm({ open: false });
    setDayAssignments(new Map([...serverAssignments].map(([k, v]) => [k, { ...v }])));
    setScheduleMap(new Map(serverSchedules));
    setter?.();
  }, [filterChangeConfirm, serverAssignments, serverSchedules]);

  // 이미 닫혀 있으면 새 객체로 set 하지 않음 — 불필요한 re-render 방지.
  const closeFilterConfirm = useCallback(() => {
    setFilterChangeConfirm((prev) => (prev.open ? { open: false } : prev));
  }, []);

  return {
    dayAssignments,
    setDayAssignments,
    serverAssignments,
    setServerAssignments,
    scheduleMap,
    setScheduleMap,
    serverSchedules,
    setServerSchedules,
    hasChanges,
    filterChangeConfirm,
    guardFilterChange,
    confirmFilterChange,
    closeFilterConfirm,
  };
}

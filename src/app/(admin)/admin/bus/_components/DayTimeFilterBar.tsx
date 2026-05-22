"use client";

import { BUS_WEEKDAYS } from "@/lib/constants/bus";
import type { BusTimeSlot } from "@/lib/types";

/**
 * BusNumbersManager / BusStopAssignmentManager 가 공유하는 요일·시간대 필터 fragment.
 *
 * - 부모가 `flex flex-wrap items-center gap-3` 컨테이너를 제공 (저장/복사 버튼 옆 배치).
 * - 필터 변경을 가드하려면 부모가 `useBusDirtyFilter().guardFilterChange` 를 감싸서 prop 으로.
 * - 스타일이 다른 컴포넌트(BusStudentAssignmentManager 의 큰 버튼·rounded-lg)는
 *   variant prop 폭증을 피하기 위해 인라인 유지.
 */
export function DayTimeFilterBar({
  day,
  onDayChange,
  timeSlotId,
  onTimeSlotChange,
  timeSlots,
  includeAllSlotsOption = false,
}: {
  day: number;
  onDayChange: (day: number) => void;
  timeSlotId: string;
  onTimeSlotChange: (id: string) => void;
  timeSlots: BusTimeSlot[];
  /** true 면 첫 옵션으로 "전체 (기본)" (value="") 노출. BusNumbersManager 용. */
  includeAllSlotsOption?: boolean;
}) {
  return (
    <>
      <div className="flex items-center gap-1">
        {BUS_WEEKDAYS.map((d) => (
          <button
            key={d.value}
            onClick={() => onDayChange(d.value)}
            className={`w-8 h-8 text-xs rounded font-medium transition-colors ${
              day === d.value
                ? "bg-slate-800 text-white"
                : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <select
        value={timeSlotId}
        onChange={(e) => onTimeSlotChange(e.target.value)}
        className="h-8 text-xs border border-slate-200 rounded px-2 bg-white"
      >
        {includeAllSlotsOption && <option value="">전체 (기본)</option>}
        {timeSlots.map((slot) => (
          <option key={slot.id} value={slot.id}>
            {slot.label} ({slot.time.slice(0, 5)})
          </option>
        ))}
      </select>
    </>
  );
}

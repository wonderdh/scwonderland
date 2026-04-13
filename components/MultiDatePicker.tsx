"use client";

import { useRef, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { ko } from "date-fns/locale";
import { eachDayOfInterval, startOfDay, format, isWeekend } from "date-fns";

type Props = {
  selected: Date[];
  onSelect: (dates: Date[]) => void;
  disablePast?: boolean;
  compact?: boolean;
};

/**
 * 통합 날짜 선택기.
 * - 0개 선택 상태에서 클릭 → 시작 날짜 (앵커)
 * - 1개 선택 상태에서 클릭 → 앵커~클릭 사이 전부 채움 (범위)
 * - 2개 이상 선택 상태에서 클릭 → 개별 토글 (추가/제거)
 * - "전체 해제"로 리셋하면 다시 범위 모드로.
 */
export function MultiDatePicker({
  selected,
  onSelect,
  disablePast = false,
  compact = false,
}: Props) {
  const today = useMemo(() => startOfDay(new Date()), []);
  // 앵커 = 첫 클릭 날짜. 범위 채움 후 null로 리셋.
  const anchorRef = useRef<Date | null>(null);

  const disabledMatcher = useMemo(() => {
    const matchers: Array<{ before: Date } | { dayOfWeek: number[] }> = [
      { dayOfWeek: [0, 6] }, // 토(6), 일(0) 비활성화
    ];
    if (disablePast) matchers.push({ before: today });
    return matchers;
  }, [disablePast, today]);

  function handleSelect(dates: Date[] | undefined) {
    const newDates = dates ?? [];

    // react-day-picker가 넘겨주는 배열의 길이 변화로 "추가됐는지 제거됐는지" 판단
    const added = newDates.length > selected.length;

    if (!added) {
      // 날짜가 제거됨 (클릭으로 해제) → 그대로 반영
      anchorRef.current = null;
      onSelect(newDates);
      return;
    }

    // 새로 추가된 날짜 찾기
    const selectedSet = new Set(selected.map((d) => d.getTime()));
    const clickedDate = newDates.find((d) => !selectedSet.has(d.getTime()));

    if (!clickedDate) {
      onSelect(newDates);
      return;
    }

    // 상태: 현재 0개 → 앵커 설정
    if (selected.length === 0) {
      anchorRef.current = clickedDate;
      onSelect([clickedDate]);
      return;
    }

    // 상태: 현재 1개 (앵커만) → 범위 채움
    if (selected.length === 1 && anchorRef.current) {
      const anchor = anchorRef.current;
      const from = anchor < clickedDate ? anchor : clickedDate;
      const to = anchor < clickedDate ? clickedDate : anchor;
      const range = eachDayOfInterval({ start: from, end: to }).filter(
        (d) => !isWeekend(d),
      );
      anchorRef.current = null;
      onSelect(range);
      return;
    }

    // 상태: 2개 이상 → 개별 토글 (react-day-picker 기본 동작 그대로)
    anchorRef.current = null;
    onSelect(newDates);
  }

  function removeDate(date: Date) {
    anchorRef.current = null;
    onSelect(selected.filter((d) => d.getTime() !== date.getTime()));
  }

  function clearAll() {
    anchorRef.current = null;
    onSelect([]);
  }

  const sortedSelected = useMemo(
    () => [...selected].sort((a, b) => a.getTime() - b.getTime()),
    [selected],
  );

  return (
    <div className="space-y-2">
      <Calendar
        mode="multiple"
        selected={selected}
        onSelect={handleSelect}
        disabled={disabledMatcher}
        locale={ko}
        className="rounded-xl border border-slate-200"
      />

      {/* 선택된 날짜 배지 */}
      {!compact && sortedSelected.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              {sortedSelected.length}일 선택
              {selected.length === 1 && (
                <span className="ml-1.5 text-[10px] text-blue-500">
                  다른 날짜 클릭 시 범위 선택
                </span>
              )}
            </span>
            {sortedSelected.length > 1 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-[10px] text-slate-400 hover:text-red-500"
              >
                전체 해제
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {sortedSelected.map((d) => (
              <Badge
                key={d.toISOString()}
                variant="outline"
                className="gap-1 bg-blue-50 text-blue-700 border-blue-200 text-[11px]"
              >
                {format(d, "M/d(EEE)", { locale: ko })}
                <button
                  type="button"
                  onClick={() => removeDate(d)}
                  className="ml-0.5 text-blue-400 hover:text-red-500"
                  aria-label={`${format(d, "M/d")} 제거`}
                >
                  x
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

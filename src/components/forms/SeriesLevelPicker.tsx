"use client";

import { useState, useMemo } from "react";
import type { Database } from "@/lib/types/database.generated";

type TextbookRow = Database["public"]["Tables"]["homework_books"]["Row"];

/** SeriesLevelPicker accepts either raw rows or the joined `TextbookWithSeries`. */
export type SeriesLevelPickerTextbook = TextbookRow & {
  series_name?: string | null;
};

export const NONE_SERIES_KEY = "__none__";

export type SeriesLevelPickerProps = {
  textbooks: SeriesLevelPickerTextbook[];
  assignedTextbookIds: Set<string>;
  value: string;
  onChange: (textbookId: string) => void;
  disabled?: boolean;
};

export function SeriesLevelPicker({
  textbooks,
  assignedTextbookIds,
  value,
  onChange,
  disabled,
}: SeriesLevelPickerProps) {
  // Group active textbooks by series_id (NULL → NONE_SERIES_KEY)
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; books: SeriesLevelPickerTextbook[] }>();
    for (const tb of textbooks) {
      if (!tb.is_active) continue;
      const key = tb.series_id ?? NONE_SERIES_KEY;
      // Prefer joined series_name, fall back to legacy `series` text column.
      const resolvedName = tb.series_name ?? tb.series ?? null;
      const name = tb.series_id
        ? (resolvedName ?? "(이름 없음)")
        : "(시리즈 없음)";
      if (!map.has(key)) map.set(key, { name, books: [] });
      map.get(key)!.books.push(tb);
    }
    return map;
  }, [textbooks]);

  // Only show series that have at least one unassigned active textbook
  const seriesOptions = useMemo(() => {
    return [...grouped.entries()]
      .filter(([, g]) => g.books.some((b) => !assignedTextbookIds.has(b.id)))
      .map(([id, g]) => ({ id, name: g.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [grouped, assignedTextbookIds]);

  // Infer the series for the currently selected value (for initialisation)
  const initialSeriesId = useMemo(() => {
    if (!value) return "";
    const tb = textbooks.find((t) => t.id === value);
    if (!tb) return "";
    return tb.series_id ?? NONE_SERIES_KEY;
  }, [value, textbooks]);

  const [selectedSeriesId, setSelectedSeriesId] = useState<string>(initialSeriesId);

  const currentBooks = selectedSeriesId
    ? (grouped.get(selectedSeriesId)?.books ?? [])
    : [];

  function handleSeriesChange(next: string) {
    setSelectedSeriesId(next);
    onChange(""); // reset textbook selection whenever series changes
  }

  return (
    <div className="space-y-2">
      {/* Step 1 — Series */}
      <select
        value={selectedSeriesId}
        onChange={(e) => handleSeriesChange(e.target.value)}
        disabled={disabled}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">시리즈를 선택하세요</option>
        {seriesOptions.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.name}
          </option>
        ))}
      </select>

      {/* Step 2 — Level / Volume */}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || !selectedSeriesId}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">
          {selectedSeriesId ? "숙제를 선택하세요" : "시리즈 먼저 선택"}
        </option>
        {currentBooks.map((tb) => {
          const taken = assignedTextbookIds.has(tb.id);
          const label = tb.level || tb.title;
          return (
            <option key={tb.id} value={tb.id} disabled={taken}>
              {label}
              {taken ? " — 이미 부여됨" : ""}
            </option>
          );
        })}
      </select>
    </div>
  );
}

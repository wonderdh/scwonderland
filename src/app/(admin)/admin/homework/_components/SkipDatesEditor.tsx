"use client";

import { useState } from "react";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function SkipDatesEditor({ value, onChange, disabled }: Props) {
  const [draft, setDraft] = useState("");

  function handleAdd() {
    if (!ISO_DATE_RE.test(draft)) return;
    if (value.includes(draft)) {
      setDraft("");
      return;
    }
    onChange([...value, draft].sort());
    setDraft("");
  }

  function handleRemove(d: string) {
    onChange(value.filter((x) => x !== d));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={disabled}
          className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={disabled || !ISO_DATE_RE.test(draft)}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:border-orange-300 hover:text-orange-700 disabled:opacity-50"
        >
          추가
        </button>
      </div>
      {value.length === 0 ? (
        <p className="text-xs text-slate-400">예외일 없음</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {value.map((d) => (
            <span
              key={d}
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800"
            >
              {d}
              <button
                type="button"
                onClick={() => handleRemove(d)}
                disabled={disabled}
                className="text-amber-600 hover:text-amber-900 disabled:opacity-50"
                aria-label={`${d} 제거`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

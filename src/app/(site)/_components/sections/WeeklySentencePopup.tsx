"use client";

import { useEffect, useState } from "react";
import { todayKst } from "@/lib/utils/date-kst";
import { WEEKLY_SENTENCE_LEVELS } from "@/lib/constants/weekly-sentence";

const DISMISS_KEY = "wonderland.weekly-sentence-dismissed";

type Props = {
  data: {
    weekNumber: number;
    items: Array<{ level: number; english: string; korean: string; answer: string | null }>;
  };
};

export function WeeklySentencePopup({ data }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { date?: string };
        if (parsed?.date === todayKst()) return;
      }
    } catch {
      /* localStorage 접근 실패 시 무시 */
    }
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, []);

  if (!open) return null;

  const close = () => setOpen(false);

  const dismissToday = () => {
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify({ date: todayKst() }));
    } catch {
      /* 무시 */
    }
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-labelledby="weekly-sentence-title"
    >
      <div
        className="w-full max-w-lg animate-in fade-in zoom-in-95 rounded-2xl bg-white p-5 shadow-2xl sm:max-w-3xl sm:p-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="mb-4 flex items-center justify-between sm:mb-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-orange-500 sm:text-base">
              Sentence of the Week
            </p>
            <h2
              id="weekly-sentence-title"
              className="mt-0.5 text-lg font-bold text-slate-800 sm:mt-1 sm:text-3xl"
            >
              이번 주의 문장
              <span className="ml-2 text-sm font-normal text-slate-400 sm:ml-3 sm:text-lg">
                Week {data.weekNumber}
              </span>
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="닫기"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* 3개 레벨 카드 */}
        <ul className="space-y-2.5 sm:space-y-4">
          {WEEKLY_SENTENCE_LEVELS.map((lv) => {
            const item = data.items.find((i) => i.level === lv.level);
            if (!item) return null;
            return (
              <li
                key={lv.level}
                className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-7 sm:py-6"
              >
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:px-3.5 sm:py-1.5 sm:text-sm ${lv.color}`}
                >
                  {lv.label}
                  <span className="opacity-60">({lv.subLabel})</span>
                </span>
                {item.answer ? (
                  <>
                    <p className="mt-1.5 break-words text-sm leading-snug text-slate-900 sm:mt-4 sm:text-2xl sm:leading-relaxed">
                      <span className="font-semibold text-slate-500">Q:</span>{" "}
                      <span className="font-semibold">{item.english}</span>
                    </p>
                    <p className="mt-0.5 break-words text-sm leading-snug text-blue-700 sm:mt-2 sm:text-2xl sm:leading-relaxed">
                      <span className="font-semibold text-blue-500">A:</span>{" "}
                      {item.answer}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-1.5 break-words text-sm font-semibold leading-snug text-slate-900 sm:mt-4 sm:text-2xl sm:leading-relaxed">
                      {item.english}
                    </p>
                    <p className="mt-0.5 text-xs leading-snug text-slate-500 sm:mt-2 sm:text-base">
                      {item.korean}
                    </p>
                  </>
                )}
              </li>
            );
          })}
        </ul>

        {/* 하단 버튼 */}
        <div className="mt-5 flex items-center justify-end gap-2 sm:mt-7 sm:gap-3">
          <button
            type="button"
            onClick={dismissToday}
            className="min-h-[40px] rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-50 sm:min-h-[48px] sm:px-6 sm:py-3 sm:text-lg"
          >
            오늘 하루 보지 않기
          </button>
          <button
            type="button"
            onClick={close}
            className="min-h-[40px] rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 sm:min-h-[48px] sm:px-6 sm:py-3 sm:text-lg"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import type {
  SeriesWithPublisher,
  SeriesLevelRow,
} from "@/app/(admin)/admin/actions";

type Props = {
  series: SeriesWithPublisher;
  levels: SeriesLevelRow[];
  onEdit: () => void;
  onDelete: () => void;
};

export function SeriesCard({ series, levels, onEdit, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);

  const activeLevels = levels.filter((l) => l.is_active);

  return (
    <div
      className={`relative rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
        !series.is_active ? "opacity-60" : ""
      }`}
    >
      {!series.is_active && (
        <div className="absolute top-1.5 left-1.5 z-10 rounded-full bg-slate-400 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          비활성
        </div>
      )}

      {/* 우상단 메뉴 */}
      <div className="absolute top-1.5 right-1.5 z-10">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="flex h-6 w-6 items-center justify-center rounded-md bg-white/85 text-slate-500 hover:bg-slate-100 shadow-sm"
          aria-label="메뉴"
        >
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-20"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-8 z-30 w-32 rounded-lg border bg-white py-1 shadow-lg text-sm">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-50"
              >
                수정
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50"
              >
                삭제
              </button>
            </div>
          </>
        )}
      </div>

      {/* 표지 — 책 비율 (3:4) */}
      <div className="relative flex aspect-[3/4] items-center justify-center rounded-t-xl bg-slate-100 overflow-hidden">
        {series.cover_image_url ? (
          <Image
            src={series.cover_image_url}
            alt={series.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 18vw"
            className="object-cover"
          />
        ) : (
          <svg
            className="h-12 w-12 text-slate-300"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
            />
          </svg>
        )}
      </div>

      {/* 본문 */}
      <div className="px-2.5 pt-2 pb-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">
            {series.name}
          </p>
          <span className="shrink-0 text-[10px] text-slate-400">
            {series.total_units}u
          </span>
        </div>
        {series.publisher && (
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {series.publisher.name}
            {series.publisher.homepage_url && (
              <a
                href={series.publisher.homepage_url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 inline-flex items-center text-blue-500 hover:text-blue-700"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
                <span className="sr-only">홈페이지</span>
              </a>
            )}
          </p>
        )}

        {/* Levels popover trigger */}
        <div className="relative mt-2">
          <button
            type="button"
            onClick={() => setLevelOpen((o) => !o)}
            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-200"
          >
            레벨 {activeLevels.length}
            <svg
              className={`h-3 w-3 transition-transform ${
                levelOpen ? "rotate-180" : ""
              }`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.25 4.4a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          {levelOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setLevelOpen(false)}
              />
              <div className="absolute left-0 top-7 z-30 w-44 rounded-lg border bg-white py-1 shadow-lg text-xs">
                {activeLevels.length === 0 ? (
                  <p className="px-3 py-2 text-slate-400">레벨 없음</p>
                ) : (
                  <ul className="max-h-48 overflow-y-auto">
                    {activeLevels.map((l) => (
                      <li
                        key={l.id}
                        className="truncate px-3 py-1.5 text-slate-700"
                      >
                        {l.level || (
                          <span className="italic text-slate-400">
                            (이름 없음)
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

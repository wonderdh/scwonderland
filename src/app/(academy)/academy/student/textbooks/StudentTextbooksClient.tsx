"use client";

import type { StudentTextbookItem } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { useState } from "react";

const STATUS_MAP = {
  not_started: { label: "시작 전", color: "bg-slate-100 text-slate-600" },
  in_progress: { label: "진행 중", color: "bg-blue-100 text-blue-700" },
  completed: { label: "완료", color: "bg-emerald-100 text-emerald-700" },
} as const;

const CATEGORY_MAP: Record<string, string> = {
  general: "일반",
  phonics: "파닉스",
  reading: "읽기",
  grammar: "문법",
  speaking: "말하기",
  writing: "쓰기",
  vocabulary: "어휘",
};

function ReadOnlyTextbookCard({ t }: { t: StudentTextbookItem }) {
  const pct = t.total_units > 0 ? Math.round((t.completed_units / t.total_units) * 100) : 0;
  const st = STATUS_MAP[t.status];

  return (
    <div
      className="rounded-lg border border-slate-200 bg-white flex flex-col overflow-hidden"
      style={{ width: 170 }}
    >
      {t.textbook_cover_image ? (
        <div className="flex items-center justify-center bg-slate-50">
          <Image
            src={t.textbook_cover_image}
            alt={t.textbook_title}
            width={170}
            height={190}
            className="object-cover"
            style={{ width: 170, height: 190 }}
            sizes="170px"
          />
        </div>
      ) : (
        <div className="flex items-center justify-center bg-slate-50" style={{ width: 170, height: 190 }}>
          <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <div className="flex items-start gap-1">
          <h3 className="text-sm font-semibold text-slate-800 truncate leading-tight flex-1">{t.textbook_title}</h3>
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${st.color}`}>
            {st.label}
          </span>
        </div>

        {t.textbook_series && (
          <p className="text-[11px] text-slate-500 truncate">{t.textbook_series}</p>
        )}

        <div className="flex items-center gap-1 flex-wrap text-[10px] text-slate-500">
          <span className="rounded bg-blue-50 px-1 py-0.5 text-blue-700 font-medium">
            {CATEGORY_MAP[t.textbook_category] ?? t.textbook_category}
          </span>
          {t.textbook_level && (
            <span className="rounded bg-slate-100 px-1 py-0.5">Lv.{t.textbook_level}</span>
          )}
          <span className="rounded bg-slate-50 px-1 py-0.5">
            {t.source_type === "class" ? `반: ${t.source_class_name ?? ""}` : "개별"}
          </span>
        </div>

        <div className="mt-1">
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                pct >= 100 ? "bg-emerald-500" : "bg-blue-500"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[10px] font-medium text-slate-500 mt-0.5 text-right">
            {t.completed_units}/{t.total_units} ({pct}%)
          </p>
        </div>
      </div>
    </div>
  );
}

export function StudentTextbooksClient({ textbooks }: { textbooks: StudentTextbookItem[] }) {
  const [showCompleted, setShowCompleted] = useState(false);

  const activeBooks = textbooks.filter((t) => t.status !== "completed");
  const completedBooks = textbooks.filter((t) => t.status === "completed");
  const inProgress = textbooks.filter((t) => t.status === "in_progress").length;
  const completed = completedBooks.length;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold tracking-tight">내 교재</h1>

      {textbooks.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="py-3 gap-0 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
            <CardContent className="text-center">
              <p className="text-2xl font-bold text-violet-700">{textbooks.length}</p>
              <p className="text-xs text-violet-600 font-medium">전체</p>
            </CardContent>
          </Card>
          <Card className="py-3 gap-0 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
            <CardContent className="text-center">
              <p className="text-2xl font-bold text-blue-700">{inProgress}</p>
              <p className="text-xs text-blue-600 font-medium">진행 중</p>
            </CardContent>
          </Card>
          <Card className="py-3 gap-0 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <CardContent className="text-center">
              <p className="text-2xl font-bold text-emerald-700">{completed}</p>
              <p className="text-xs text-emerald-600 font-medium">완료</p>
            </CardContent>
          </Card>
        </div>
      )}

      {textbooks.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
          <svg className="mx-auto h-12 w-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="text-sm font-medium text-slate-500 mb-1">배정된 교재가 없습니다</p>
          <p className="text-xs text-slate-400">교재가 배정되면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <>
          {/* 진행 중 교재 섹션 */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800">진행 중 교재</h2>
            {activeBooks.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
                <svg className="mx-auto h-12 w-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <p className="text-sm font-medium text-slate-500">모든 교재를 완료했습니다!</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {activeBooks.map((t) => (
                  <ReadOnlyTextbookCard key={t.id} t={t} />
                ))}
              </div>
            )}
          </div>

          {/* 완료 교재 섹션 */}
          {completedBooks.length > 0 && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
              >
                <svg
                  className={`h-4 w-4 transition-transform ${showCompleted ? "rotate-90" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                완료 교재
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  {completedBooks.length}
                </span>
              </button>

              {showCompleted && (
                <div className="flex flex-wrap gap-3">
                  {completedBooks.map((t) => (
                    <ReadOnlyTextbookCard key={t.id} t={t} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { razCoverUrl } from "@/lib/raz/cover";
import { formatDateYmdKst } from "@/lib/utils/date-kst";
import type { RazBook, RazReadLogEntry } from "@/lib/types";
import type { ToggleReadAction } from "@/components/reading/BookGrid";

// v2 실험 UI: 레벨 선택 → 해당 레벨만 5×4 페이지네이션. PC 전용 고정 레이아웃.
// 카드 마크업은 BookGrid(v1) 복사본 — 실험 확정 전까지 의도적으로 분리 유지.
const PAGE_SIZE = 20; // 가로 5 × 세로 4

interface BookGridV2Props {
  books: RazBook[]; // level_order 순 입력 전제 (레벨 드롭다운이 이 순서에 의존)
  readLogs: RazReadLogEntry[];
  toggleAction: ToggleReadAction;
}

export function BookGridV2({ books, readLogs, toggleAction }: BookGridV2Props) {
  const levels = useMemo(() => [...new Set(books.map((b) => b.level))], [books]);
  const [level, setLevel] = useState(levels[0] ?? "aa");
  const [page, setPage] = useState(0);
  const [, startTransition] = useTransition();

  // bookId → 체크 일시(ISO). 존재 여부 = 읽음.
  const [optimisticRead, setOptimisticRead] = useOptimistic(
    useMemo(() => new Map(readLogs.map((r) => [r.bookId, r.readAt])), [readLogs]),
    (prev, action: { bookId: number; read: boolean }) => {
      const next = new Map(prev);
      if (action.read) next.set(action.bookId, new Date().toISOString());
      else next.delete(action.bookId);
      return next;
    },
  );

  // 선택 레벨 내 제목 알파벳순
  const levelBooks = useMemo(
    () =>
      books
        .filter((b) => b.level === level)
        .sort((a, b) => a.title.localeCompare(b.title) || a.id - b.id),
    [books, level],
  );
  const pageCount = Math.max(1, Math.ceil(levelBooks.length / PAGE_SIZE));
  const pageBooks = levelBooks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function handleToggle(book: RazBook) {
    const next = !optimisticRead.has(book.id);
    startTransition(async () => {
      setOptimisticRead({ bookId: book.id, read: next });
      const result = await toggleAction(book.id, next);
      if (result?.error) toast.error(result.error);
    });
  }

  if (books.length === 0) {
    return <p className="py-20 text-center text-sm text-muted-foreground">책 데이터가 없습니다.</p>;
  }

  return (
    <div className="w-fit space-y-4">
      {/* 레벨 선택 + 현황 */}
      <div className="flex items-center gap-3 text-sm">
        <select
          value={level}
          onChange={(e) => {
            setLevel(e.target.value);
            setPage(0);
          }}
          className="h-9 rounded-md border border-slate-200 px-2"
        >
          {levels.map((lv) => (
            <option key={lv} value={lv}>
              {lv}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          {levelBooks.length}권 · 읽음 {levelBooks.filter((b) => optimisticRead.has(b.id)).length}권
        </span>
      </div>

      {/* 5×4 고정 그리드 */}
      <ul className="grid w-fit grid-cols-5 gap-3">
        {pageBooks.map((book) => {
          const readAt = optimisticRead.get(book.id);
          const read = readAt != null;
          return (
            <li
              key={book.id}
              className={`w-[150px] rounded-lg border p-2 ${
                read ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"
              }`}
            >
              <button
                type="button"
                onClick={() => handleToggle(book)}
                className="block w-full text-left"
                aria-pressed={read}
              >
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={razCoverUrl(book.id)}
                    alt={book.title}
                    loading="lazy"
                    className="aspect-[25/19] w-full rounded object-cover bg-slate-100"
                    onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                  />
                  {read && (
                    <span className="absolute right-1 top-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      ✓ 읽음
                    </span>
                  )}
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm font-medium text-slate-800">{book.title}</p>
                <div className="mt-1.5 flex flex-wrap gap-1 text-xs font-medium">
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700">{book.level}</span>
                  {book.lexile && (
                    <span className="rounded bg-orange-100 px-1.5 py-0.5 text-orange-700">{book.lexile}</span>
                  )}
                  {book.genre && (
                    <span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-700">{book.genre}</span>
                  )}
                </div>
                {read && (
                  <p className="mt-1 text-xs font-medium text-emerald-700">✓ {formatDateYmdKst(readAt)}</p>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* 페이지네이션 */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-1 text-sm">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            className="h-8 w-8 rounded-md border border-slate-200 disabled:opacity-40"
          >
            ‹
          </button>
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPage(i)}
              className={`h-8 w-8 rounded-md border ${
                i === page
                  ? "border-slate-800 bg-slate-800 font-semibold text-white"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              {i + 1}
            </button>
          ))}
          <button
            type="button"
            disabled={page === pageCount - 1}
            onClick={() => setPage(page + 1)}
            className="h-8 w-8 rounded-md border border-slate-200 disabled:opacity-40"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}

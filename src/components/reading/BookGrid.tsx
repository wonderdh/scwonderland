"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { razCoverUrl } from "@/lib/raz/cover";
import { formatDateYmdKst } from "@/lib/utils/date-kst";
import type { RazBook, RazReadLogEntry } from "@/lib/types";

export type ToggleReadAction = (bookId: number, read: boolean) => Promise<{ error?: string }>;

// 레벨 선택 → 해당 레벨만 20권 페이지네이션.
// PC(md 이상): 5×4 카드 그리드. 모바일: 썸네일 + 텍스트 한 줄 리스트.
const PAGE_SIZE = 20; // PC 기준 가로 5 × 세로 4

interface BookGridProps {
  books: RazBook[]; // level_order 순 입력 전제 (레벨 드롭다운이 이 순서에 의존)
  readLogs: RazReadLogEntry[];
  toggleAction: ToggleReadAction;
}

export function BookGrid({ books, readLogs, toggleAction }: BookGridProps) {
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

  // 레벨별 진행 현황 (optimisticRead 기반이라 토글 즉시 칩 색에 반영)
  const levelStats = useMemo(() => {
    const m = new Map<string, { total: number; read: number }>();
    for (const b of books) {
      const s = m.get(b.level) ?? { total: 0, read: 0 };
      s.total++;
      if (optimisticRead.has(b.id)) s.read++;
      m.set(b.level, s);
    }
    return m;
  }, [books, optimisticRead]);

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
      // 실패 시 useOptimistic 이 서버 상태(revalidate 결과)로 자동 복원
    });
  }

  if (books.length === 0) {
    return <p className="py-20 text-center text-sm text-muted-foreground">책 데이터가 없습니다.</p>;
  }

  return (
    <div className="w-full space-y-4 md:w-fit">
      {/* 레벨 선택 칩 — 시작 전(회색) / 진행 중(호박색) / 완료(에메랄드) */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {levels.map((lv) => {
            const s = levelStats.get(lv) ?? { total: 0, read: 0 };
            const status = s.read === 0 ? "none" : s.read === s.total ? "done" : "progress";
            const color =
              status === "done"
                ? "bg-emerald-100 text-emerald-700"
                : status === "progress"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-slate-100 text-slate-500";
            const selected = lv === level;
            return (
              <button
                key={lv}
                type="button"
                title={`${s.read}/${s.total}권`}
                onClick={() => {
                  setLevel(lv);
                  setPage(0);
                }}
                className={`rounded-md px-2 py-1 text-xs font-semibold ${color} ${
                  selected ? "ring-2 ring-slate-700" : "hover:ring-1 hover:ring-slate-300"
                }`}
              >
                {lv}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-slate-700">{level}</span> · {levelBooks.length}권 중 읽음{" "}
          {levelBooks.filter((b) => optimisticRead.has(b.id)).length}권
          <span className="ml-3 inline-flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-100 ring-1 ring-slate-300" /> 시작 전
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-100 ring-1 ring-amber-300" /> 진행 중
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-100 ring-1 ring-emerald-300" /> 완료
          </span>
        </p>
      </div>

      {/* 모바일: 썸네일 리스트 / md 이상: 5×4 카드 그리드 */}
      <ul className="flex flex-col gap-2 md:grid md:w-fit md:grid-cols-5 md:gap-3">
        {pageBooks.map((book) => {
          const readAt = optimisticRead.get(book.id);
          const read = readAt != null;
          return (
            <li
              key={book.id}
              className={`rounded-lg border p-2 md:w-[150px] ${
                read ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"
              }`}
            >
              <button
                type="button"
                onClick={() => handleToggle(book)}
                className="flex w-full items-center gap-3 text-left md:block"
                aria-pressed={read}
              >
                <div className="relative w-16 shrink-0 md:w-full">
                  {/* Supabase Storage 이미지 — next/image 미사용 (원격 최적화 불필요, 250x190 원본) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={razCoverUrl(book.id)}
                    alt={book.title}
                    loading="lazy"
                    className="aspect-[25/19] w-full rounded object-cover bg-slate-100"
                    onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                  />
                  {read && (
                    <span className="absolute right-1 top-1 hidden rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white md:block">
                      ✓ 읽음
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 md:flex-none">
                  <p className="line-clamp-2 text-sm font-medium text-slate-800 md:mt-1.5">{book.title}</p>
                  <div className="mt-1 flex flex-wrap gap-1 text-xs font-medium md:mt-1.5">
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
                </div>
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

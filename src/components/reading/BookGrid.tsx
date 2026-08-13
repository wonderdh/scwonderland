"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { razCoverUrl } from "@/lib/raz/cover";
import type { RazBook } from "@/lib/types";

export type ToggleReadAction = (bookId: number, read: boolean) => Promise<{ error?: string }>;

interface BookGridProps {
  books: RazBook[];          // level_order → title 순 정렬 전제 (getRazBooks 가 보장)
  readBookIds: number[];
  canToggle: boolean;
  toggleAction?: ToggleReadAction;
}

export function BookGrid({ books, readBookIds, canToggle, toggleAction }: BookGridProps) {
  const [level, setLevel] = useState("all");
  const [genre, setGenre] = useState("all");
  const [genre2, setGenre2] = useState("all");
  const [lexMin, setLexMin] = useState("");
  const [lexMax, setLexMax] = useState("");
  const [query, setQuery] = useState("");
  const [readFilter, setReadFilter] = useState<"all" | "read" | "unread">("all");
  const [, startTransition] = useTransition();

  const [optimisticRead, setOptimisticRead] = useOptimistic(
    useMemo(() => new Set(readBookIds), [readBookIds]),
    (prev, action: { bookId: number; read: boolean }) => {
      const next = new Set(prev);
      if (action.read) next.add(action.bookId);
      else next.delete(action.bookId);
      return next;
    },
  );

  // books 가 level_order 순이라 레벨 목록도 자동으로 aa→Z2 순
  const levels = useMemo(() => [...new Set(books.map((b) => b.level))], [books]);
  const genre2List = useMemo(
    () => [...new Set(books.map((b) => b.genre2).filter((g): g is string => g != null))].sort(),
    [books],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = lexMin === "" ? null : Number(lexMin);
    const max = lexMax === "" ? null : Number(lexMax);
    return books.filter((b) => {
      if (level !== "all" && b.level !== level) return false;
      if (genre !== "all" && b.genre !== genre) return false;
      if (genre2 !== "all" && b.genre2 !== genre2) return false;
      if (min != null && (b.lexile_num == null || b.lexile_num < min)) return false;
      if (max != null && (b.lexile_num == null || b.lexile_num > max)) return false;
      if (q && !b.title.toLowerCase().includes(q)) return false;
      if (readFilter === "read" && !optimisticRead.has(b.id)) return false;
      if (readFilter === "unread" && optimisticRead.has(b.id)) return false;
      return true;
    });
  }, [books, level, genre, genre2, lexMin, lexMax, query, readFilter, optimisticRead]);

  function handleToggle(book: RazBook) {
    if (!canToggle || !toggleAction) return;
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
    <div className="space-y-4">
      {/* 진행률 요약 */}
      <p className="text-sm text-slate-600">
        읽음 <span className="font-semibold text-slate-800">{optimisticRead.size}</span> / {books.length}권
        ({Math.round((optimisticRead.size / books.length) * 100)}%)
      </p>

      {/* 필터 — 전부 클라이언트 메모리 처리 */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="제목 검색"
          className="h-9 w-48 rounded-md border border-slate-200 px-3"
        />
        <select value={level} onChange={(e) => setLevel(e.target.value)} className="h-9 rounded-md border border-slate-200 px-2">
          <option value="all">레벨 전체</option>
          {levels.map((lv) => <option key={lv} value={lv}>{lv}</option>)}
        </select>
        <select value={genre} onChange={(e) => setGenre(e.target.value)} className="h-9 rounded-md border border-slate-200 px-2">
          <option value="all">장르 전체</option>
          <option value="Fiction">Fiction</option>
          <option value="Nonfiction">Nonfiction</option>
        </select>
        <select value={genre2} onChange={(e) => setGenre2(e.target.value)} className="h-9 rounded-md border border-slate-200 px-2">
          <option value="all">세부장르 전체</option>
          {genre2List.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <span className="flex items-center gap-1">
          Lexile
          <input type="number" value={lexMin} onChange={(e) => setLexMin(e.target.value)} placeholder="min" className="h-9 w-20 rounded-md border border-slate-200 px-2" />
          ~
          <input type="number" value={lexMax} onChange={(e) => setLexMax(e.target.value)} placeholder="max" className="h-9 w-20 rounded-md border border-slate-200 px-2" />
        </span>
        <select value={readFilter} onChange={(e) => setReadFilter(e.target.value as typeof readFilter)} className="h-9 rounded-md border border-slate-200 px-2">
          <option value="all">전체</option>
          <option value="read">읽은 책만</option>
          <option value="unread">안 읽은 책만</option>
        </select>
        <span className="text-xs text-muted-foreground">{filtered.length}권</span>
      </div>

      {/* 목록 — content-visibility 로 오프스크린 렌더 비용 절감 (가상화 라이브러리 불필요) */}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {filtered.map((book) => {
          const read = optimisticRead.has(book.id);
          return (
            <li
              key={book.id}
              className="rounded-lg border border-slate-200 bg-white p-2 [content-visibility:auto] [contain-intrinsic-size:auto_240px]"
            >
              <button
                type="button"
                onClick={() => handleToggle(book)}
                disabled={!canToggle}
                className="block w-full text-left disabled:cursor-default"
                aria-pressed={read}
              >
                <div className="relative">
                  {/* Supabase Storage 이미지 — next/image 미사용 (원격 최적화 불필요, 190px 원본) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={razCoverUrl(book.id)}
                    alt={book.title}
                    loading="lazy"
                    className="aspect-[3/4] w-full rounded object-cover bg-slate-100"
                    onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                  />
                  {read && (
                    <span className="absolute right-1 top-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      ✓ 읽음
                    </span>
                  )}
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs font-medium text-slate-800">{book.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {book.level}{book.lexile ? ` · ${book.lexile}` : ""}{book.genre ? ` · ${book.genre}` : ""}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

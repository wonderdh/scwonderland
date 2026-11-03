"use client";

import { useState } from "react";
import { useHomeworkBoard } from "@/components/homework/useHomeworkBoard";
import { BoardStudentCard } from "@/components/homework/BoardStudentList";
import { filterChip } from "@/lib/ui/filter-chip";

export type BoardSeriesOption = { id: string; name: string };
export type BoardLevelsBySeries = Record<string, string[]>; // seriesId → distinct levels (sorted)

type Props = {
  seriesOptions: BoardSeriesOption[];
  levelsBySeries: BoardLevelsBySeries;
  todayKst: string;
};

export function HomeworkBoard({ seriesOptions, levelsBySeries, todayKst }: Props) {
  const board = useHomeworkBoard(todayKst);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null); // PC 2-pane 용

  const levels = board.seriesId ? levelsBySeries[board.seriesId] ?? [] : [];

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const Chips = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-xs font-semibold text-slate-500 w-12">시리즈</span>
        {seriesOptions.map((s) => {
          const active = board.seriesId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => board.selectStpoint(active ? null : s.id, null)}
              className={filterChip(active)}
            >
              {s.name || "(이름 없음)"}
            </button>
          );
        })}
      </div>
      {board.seriesId && levels.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="shrink-0 text-xs font-semibold text-slate-500 w-12">레벨</span>
          {levels.map((lv) => {
            const active = board.level === lv;
            return (
              <button
                key={lv}
                type="button"
                onClick={() => board.selectStpoint(board.seriesId, active ? null : lv)}
                className={filterChip(active)}
              >
                {lv}
              </button>
            );
          })}
        </div>
      )}
      <input
        type="search"
        value={board.search}
        onChange={(e) => board.setSearch(e.target.value)}
        placeholder="영어이름 / 한글이름 / 반 검색"
        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-slate-400"
      />
    </div>
  );

  const SaveBar = board.pendingCount > 0 && (
    <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 shadow-lg">
      <span className="text-sm text-orange-700 font-medium">{board.pendingCount}건 변경됨 (미저장)</span>
      <div className="flex gap-2">
        <button type="button" onClick={board.cancel} disabled={board.isSaving}
          className="px-4 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 border border-slate-200 bg-white disabled:opacity-50">취소</button>
        <button type="button" onClick={board.save} disabled={board.isSaving}
          className="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary/90 border border-primary disabled:opacity-50">
          {board.isSaving ? "저장 중…" : "저장"}</button>
      </div>
    </div>
  );

  const emptyHint = !board.seriesId
    ? "시리즈를 선택하세요."
    : board.isLoading
      ? "불러오는 중…"
      : board.filteredStudents.length === 0
        ? "해당 시리즈·레벨에 학생이 없습니다."
        : null;

  return (
    <div className="space-y-4">
      {Chips}

      {emptyHint ? (
        <div className="rounded-xl border bg-card py-12 text-center">
          <p className="text-sm text-muted-foreground">{emptyHint}</p>
        </div>
      ) : (
        <>
          {/* 모바일: 아코디언 */}
          <div className="space-y-3 lg:hidden">
            {board.filteredStudents.map((s) => (
              <BoardStudentCard
                key={s.id}
                student={s}
                books={board.byStudent[s.id] ?? []}
                isAbsent={board.absentStudentIds.has(s.id)}
                expanded={expanded.has(s.id)}
                onToggle={() => toggleExpand(s.id)}
                editable
                onUnitClick={(tbId, unit) => board.unitClick(s.id, tbId, unit)}
                dirtyNumbers={(tbId) => board.dirtyNumbers(s.id, tbId)}
              />
            ))}
          </div>

          {/* PC: 2-pane (좌 리스트 / 우 선택 학생 그리드) */}
          <div className="hidden lg:grid lg:grid-cols-[320px_1fr] lg:gap-4">
            <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1">
              {board.filteredStudents.map((s) => {
                const sel = selectedStudentId === s.id;
                const isAbsent = board.absentStudentIds.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedStudentId(s.id)}
                    className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                      sel ? "border-primary bg-primary/5" : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-sm font-semibold text-slate-900">
                      {s.english_name ?? s.korean_name ?? s.id.slice(0, 6)}
                    </span>
                    <span className="ml-1.5 text-[11px] text-slate-400">
                      {s.korean_name && s.english_name ? `${s.korean_name} · ` : ""}{s.className}
                    </span>
                    {isAbsent && <span className="ml-1.5 text-[11px] text-slate-400">(결석)</span>}
                  </button>
                );
              })}
            </div>
            <div className="min-w-0">
              {selectedStudentId && board.byStudent[selectedStudentId] ? (
                <BoardStudentCard
                  student={board.filteredStudents.find((s) => s.id === selectedStudentId)!}
                  books={board.byStudent[selectedStudentId] ?? []}
                  isAbsent={board.absentStudentIds.has(selectedStudentId)}
                  expanded
                  onToggle={() => {}}
                  editable
                  onUnitClick={(tbId, unit) => board.unitClick(selectedStudentId, tbId, unit)}
                  dirtyNumbers={(tbId) => board.dirtyNumbers(selectedStudentId, tbId)}
                />
              ) : (
                <div className="rounded-xl border bg-card py-12 text-center">
                  <p className="text-sm text-muted-foreground">왼쪽에서 학생을 선택하세요.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {SaveBar}
    </div>
  );
}

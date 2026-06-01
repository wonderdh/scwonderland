"use client";

import { useMemo, useState } from "react";
import { KST_DAY_LABELS } from "@/lib/utils/date-kst";
import { CLASS_COLOR_PALETTE } from "@/lib/constants/class";
import type { HomeworkClassPickerOption } from "@/app/(admin)/admin/actions/class-actions";
import type { TextbookWithSeries } from "@/app/(admin)/admin/actions/textbook-actions";
import {
  useTodayClassEditor,
  type GroupFilter,
} from "../_hooks/useTodayClassEditor";
import { ClassCard } from "./ClassCard";

type Props = {
  classes: HomeworkClassPickerOption[];
  /** "YYYY-MM-DD" (KST). */
  todayKst: string;
  /** 1=Mon..5=Fri. */
  todayDow: number;
  /** student_id[] — 오늘 결석한 학생. */
  initialAbsentStudentIds: string[];
  /** 배정 책 태그 라벨용 — textbook id → 라벨 매핑 소스. */
  textbooks: TextbookWithSeries[];
  /** 페이지 자체 헤더 표시 여부. 모바일(/m)은 자체 헤더가 있어 false. 기본 true. */
  showHeader?: boolean;
};

const GROUPS: GroupFilter[] = ["유치부", "오후반"];
const WEEKDAYS = [1, 2, 3, 4, 5];

export function TodayPageClient(props: Props): React.JSX.Element {
  const { showHeader = true } = props;
  const editor = useTodayClassEditor(props);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // textbook id → 태그 라벨 (시리즈명 우선, 레벨 있으면 덧붙임).
  const bookLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of props.textbooks) {
      const base = t.series_name ?? t.title;
      map[t.id] = t.level ? `${base} ${t.level}` : base;
    }
    return map;
  }, [props.textbooks]);

  // textbook id → 태그 색. 같은 시리즈는 같은 색(레벨 무관), 시리즈가 없으면 책별로.
  const bookColors = useMemo(() => {
    const seriesIndex = new Map<string, number>();
    const map: Record<string, (typeof CLASS_COLOR_PALETTE)[number]> = {};
    for (const t of props.textbooks) {
      const key = t.series_id ?? t.id;
      let idx = seriesIndex.get(key);
      if (idx === undefined) {
        idx = seriesIndex.size;
        seriesIndex.set(key, idx);
      }
      map[t.id] = CLASS_COLOR_PALETTE[idx % CLASS_COLOR_PALETTE.length];
    }
    return map;
  }, [props.textbooks]);

  function toggleCard(classId: string, next: boolean) {
    setExpanded((prev) => {
      const set = new Set(prev);
      if (next) set.add(classId);
      else set.delete(classId);
      return set;
    });
  }

  function expandAll() {
    setExpanded(new Set(editor.filteredClasses.map((c) => c.id)));
  }
  function collapseAll() {
    setExpanded(new Set());
  }

  const classes: HomeworkClassPickerOption[] = editor.filteredClasses;

  return (
    <div className="space-y-4">
      {/* 헤더 (모바일은 자체 헤더 사용 → 숨김) */}
      {showHeader && (
        <header>
          <h1 className="text-xl font-bold text-slate-900">오늘 수업</h1>
          <p className="mt-1 text-sm text-slate-500">
            필터에 맞는 반들이 접힌 카드로 나옵니다. 반을 펼치면 <b>출결</b>·<b>숙제</b> 탭으로
            나뉘고, 숙제 탭에선 부여된 책 중 하나를 골라 그 책만 체크합니다. 결석 처리한 학생은
            숙제 그리드가 자동 회색·비활성됩니다.
          </p>
        </header>
      )}

      {/* 필터 바 */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          {/* 그룹 토글 */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">구분</span>
            <div className="flex gap-1">
              {GROUPS.map((g) => {
                const active = editor.group === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => editor.setGroup(g)}
                    className={`h-8 rounded px-3 text-xs font-medium transition-colors ${
                      active
                        ? "bg-slate-800 text-white"
                        : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 요일 칩 */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">요일</span>
            <div className="flex gap-1">
              {WEEKDAYS.map((d) => {
                const active = editor.day === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => editor.setDay(d)}
                    className={`h-8 w-8 rounded text-xs font-medium transition-colors ${
                      active
                        ? "bg-slate-800 text-white"
                        : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {KST_DAY_LABELS[d]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 시간대 select */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">시간대</span>
            <select
              value={editor.periodId}
              onChange={(e) => editor.setPeriodId(e.target.value)}
              className="h-8 rounded border border-slate-200 bg-white px-2 text-xs"
            >
              <option value="">전체</option>
              {editor.availablePeriods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.id === editor.defaultPeriodId ? " · 첫 수업" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* 날짜 */}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">날짜</span>
            <input
              type="date"
              value={editor.date}
              onChange={(e) => editor.setDate(e.target.value)}
              className="h-8 rounded border border-slate-200 bg-white px-2 text-xs"
            />
          </div>
        </div>
      </div>

      {/* 가이드 + 전체 펼치기/접기 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex-1 min-w-0">
          셀 클릭: <b>미완료</b> → <b className="text-emerald-700">완료</b> →{" "}
          <b className="text-red-600">결손</b> → <b>미완료</b>. 빨강 점선 = 예정일 지남, amber =
          오늘 예정. 결석 처리한 학생은 숙제 그리드가 자동 회색·비활성.
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button
            type="button"
            onClick={expandAll}
            className="rounded-md border border-slate-200 px-3 py-1 text-xs hover:bg-slate-50"
          >
            모두 펼치기
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded-md border border-slate-200 px-3 py-1 text-xs hover:bg-slate-50"
          >
            모두 접기
          </button>
        </div>
      </div>

      {/* 반 카드 리스트 */}
      {classes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-400">
          선택한 조건에 수업이 있는 반이 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {classes.map((cls) => (
            <ClassCard
              key={cls.id}
              cls={cls}
              editor={editor}
              bookLabels={bookLabels}
              bookColors={bookColors}
              expanded={expanded.has(cls.id)}
              onToggle={(next) => toggleCard(cls.id, next)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

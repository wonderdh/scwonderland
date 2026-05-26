"use client";

import { useState } from "react";
import { UnitProgressGrid } from "@/components/homework/UnitProgressGrid";
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_CONFIG,
} from "@/lib/constants/attendance";
import type { AttendanceStatus } from "@/lib/constants/attendance";
import type { TodayClassEditor, TodayStudent } from "../_hooks/useTodayClassEditor";

type Props = {
  classId: string;
  student: TodayStudent;
  editor: TodayClassEditor;
};

/** 출결 상태 → 학생 카드 색 (border + 헤더 tint). */
const STATUS_CARD: Record<AttendanceStatus, { row: string; head: string }> = {
  present: { row: "border-emerald-300 bg-emerald-50/40", head: "bg-emerald-50" },
  absent: { row: "border-red-300 bg-red-50/40", head: "bg-red-50" },
  late: { row: "border-amber-300 bg-amber-50/40", head: "bg-amber-50" },
  early_leave: { row: "border-purple-300 bg-purple-50/40", head: "bg-purple-50" },
};

export function StudentRow({ classId, student, editor }: Props) {
  const [collapsed, setCollapsed] = useState(false); // 기본 펼침

  const status = editor.getMergedAttendance(classId, student.studentId);
  const isAbsent = status === "absent";
  const card = status ? STATUS_CARD[status] : null;

  const canMarkAttendance = student.studentProfileId !== null;

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-colors ${
        card ? card.row : "border-slate-200 bg-white"
      }`}
    >
      {/* 헤더: 이름(접기 토글) + 출결 버튼 4종 */}
      <div
        className={`flex items-center gap-3 px-3 py-2.5 border-b border-slate-200 flex-wrap transition-colors ${
          card ? card.head : "bg-slate-50/60"
        }`}
      >
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
        >
          <span
            className={`text-slate-400 shrink-0 transition-transform ${
              collapsed ? "" : "rotate-90"
            }`}
          >
            ▶
          </span>
          <span className="min-w-0">
            <span className="text-sm font-semibold text-slate-900">
              {student.koreanName ?? student.studentId.slice(0, 6)}
            </span>
            {student.englishName && (
              <span className="ml-1 text-xs text-slate-400">({student.englishName})</span>
            )}
          </span>
        </button>

        <div className="flex gap-1 shrink-0">
          {ATTENDANCE_STATUSES.map((st) => {
            const cfg = ATTENDANCE_STATUS_CONFIG[st];
            const active = status === st;
            return (
              <button
                key={st}
                type="button"
                disabled={!canMarkAttendance}
                onClick={() =>
                  canMarkAttendance &&
                  editor.setAttendance(classId, student.studentProfileId!, st)
                }
                className={`h-7 rounded px-2.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  active ? cfg.activeClass : cfg.inactiveClass
                }`}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 숙제 그리드 — 접으면 숨김. 결석 시 회색·비활성. */}
      {!collapsed && (
        <div
          className="p-2 space-y-2 transition-opacity"
          style={{
            opacity: isAbsent ? 0.45 : 1,
            pointerEvents: isAbsent ? "none" : "auto",
          }}
        >
          {student.books.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">부여된 책이 없습니다.</p>
          ) : (
            student.books.map((book) => {
              const dirty = editor.dirtyUnitNumbers(classId, student.studentId, book.id);
              // pending 변경을 반영한 units (UnitProgressGrid 가 자체 status 로 색칠).
              const units = book.units.map((u) => ({
                ...u,
                status: editor.getMergedUnitStatus(
                  classId,
                  student.studentId,
                  book.id,
                  u.unitNumber,
                  u.status
                ),
              }));
              return (
                <UnitProgressGrid
                  key={book.id}
                  textbook={book}
                  units={units}
                  editable={!isAbsent}
                  dirtyNumbers={dirty}
                  onUnitClick={
                    isAbsent
                      ? undefined
                      : (unitNumber) =>
                          editor.cycleUnit(
                            classId,
                            student.studentId,
                            book.id,
                            unitNumber
                          )
                  }
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

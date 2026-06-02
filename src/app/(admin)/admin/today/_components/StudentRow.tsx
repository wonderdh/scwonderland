"use client";

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
  /** "attendance" → 출결 버튼만, "homework" → 선택한 책 1권 그리드만. */
  mode: "attendance" | "homework";
  /** homework 모드에서 표시할 책(class_homework_book) id. */
  selectedBookId?: string | null;
};

/** 출결 상태 → 행 테두리/배경 tint. */
const STATUS_ROW: Record<AttendanceStatus, string> = {
  present: "border-emerald-300 bg-emerald-50/40",
  absent: "border-red-300 bg-red-50/40",
  late: "border-amber-300 bg-amber-50/40",
  early_leave: "border-purple-300 bg-purple-50/40",
};

export function StudentRow({
  classId,
  student,
  editor,
  mode,
  selectedBookId,
}: Props) {
  const status = editor.getMergedAttendance(classId, student.studentId);
  const isAbsent = status === "absent";
  const rowTint = status ? STATUS_ROW[status] : "border-slate-200 bg-white";
  const canMarkAttendance = student.studentProfileId !== null;

  const name = (
    <span className="min-w-0">
      <span className="text-sm font-semibold text-slate-900">
        {student.koreanName ?? student.studentId.slice(0, 6)}
      </span>
      {student.englishName && (
        <span className="ml-1 text-xs text-slate-400">
          ({student.englishName})
        </span>
      )}
    </span>
  );

  // ── 출결 모드: 이름 + 출결 버튼 4종 ──────────────────────────────────────────
  if (mode === "attendance") {
    return (
      <div
        className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 flex-wrap transition-colors ${rowTint}`}
      >
        <div className="min-w-0 flex-1">{name}</div>
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
    );
  }

  // ── 숙제 모드: [이름 + 진도] | [인라인 unit 그리드] ─────────────────────────
  const book = selectedBookId
    ? student.books.find((b) => b.id === selectedBookId)
    : undefined;
  const dirty = book
    ? editor.dirtyUnitNumbers(classId, student.studentId, book.id)
    : new Set<number>();
  const units = book
    ? book.units.map((u) => ({
        ...u,
        status: editor.getMergedUnitStatus(
          classId,
          student.studentId,
          book.id,
          u.unitNumber,
          u.status
        ),
      }))
    : [];
  const completedCount = units.filter((u) => u.status === "completed").length;

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${rowTint}`}
    >
      {/* 좌측: 이름 + 진도 카운트 (고정폭) */}
      <div className="w-28 shrink-0 sm:w-32">
        {name}
        {book && (
          <p className="mt-0.5 text-xs tabular-nums text-slate-500">
            완료 {completedCount}/{book.total_units}
          </p>
        )}
        {isAbsent && (
          <p className="mt-0.5 text-[11px] font-medium text-red-600">
            결석 · 비활성
          </p>
        )}
      </div>

      {/* 우측: 클릭 가능한 unit 그리드 (인라인, 헤더 없음) */}
      <div className="min-w-0 flex-1">
        {!book ? (
          <p className="py-2 text-xs text-slate-400">
            이 학생에겐 이 책이 부여되지 않았습니다.
          </p>
        ) : (
          <div
            style={{
              opacity: isAbsent ? 0.45 : 1,
              pointerEvents: isAbsent ? "none" : "auto",
            }}
          >
            <UnitProgressGrid
              textbook={book}
              units={units}
              editable={!isAbsent}
              hideHeader
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
          </div>
        )}
      </div>
    </div>
  );
}

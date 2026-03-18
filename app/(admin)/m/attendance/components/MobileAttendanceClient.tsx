"use client";

import { useState } from "react";
import { useAttendanceEditor, type GroupFilter } from "@/app/(admin)/admin/attendance/hooks/useAttendanceEditor";
import { StudentSearchPanel } from "@/app/(admin)/admin/attendance/components/StudentSearchPanel";
import type { ClassWithDetails } from "@/lib/types";

type StudentItem = {
  id: string;
  korean_name: string | null;
  english_name: string | null;
  age: number | null;
};

const STATUS_CONFIG: Record<
  string,
  { label: string; active: string; inactive: string }
> = {
  present: {
    label: "출석",
    active: "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-400",
    inactive: "bg-gray-100 text-gray-500",
  },
  absent: {
    label: "결석",
    active: "bg-red-100 text-red-700 ring-2 ring-red-400",
    inactive: "bg-gray-100 text-gray-500",
  },
  late: {
    label: "지각",
    active: "bg-amber-100 text-amber-700 ring-2 ring-amber-400",
    inactive: "bg-gray-100 text-gray-500",
  },
};

const GROUPS: GroupFilter[] = ["유치부", "오후반"];
type Mode = "class" | "student";

export function MobileAttendanceClient({
  initialClasses,
  allStudents,
  today,
}: {
  initialClasses: ClassWithDetails[];
  allStudents: StudentItem[];
  today: string;
}) {
  const [mode, setMode] = useState<Mode>("class");

  const {
    groupFilter,
    setGroupFilter,
    selectedClassId,
    setSelectedClassId,
    date,
    setDate,
    students,
    loading,
    saving,
    saveError,
    isDirty,
    filteredClasses,
    setStudentStatus,
    setStudentNote,
    markAllPresent,
    getMergedStatus,
    handleSave,
    pendingEdits,
  } = useAttendanceEditor(initialClasses, today, false); // 모바일: 자동 선택 안 함

  const selectedClass = initialClasses.find((c) => c.id === selectedClassId);

  // ── 학생 검색 모드 ──
  if (mode === "student") {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
          <h1 className="text-base font-semibold text-foreground flex-1">출결 관리</h1>
          <div className="flex gap-1 p-0.5 bg-muted rounded-lg">
            <button
              onClick={() => setMode("class")}
              className="text-xs font-medium px-3 py-1 rounded-md text-muted-foreground hover:text-foreground"
            >
              반별
            </button>
            <button
              className="text-xs font-medium px-3 py-1 rounded-md bg-background text-foreground shadow-sm"
            >
              학생 검색
            </button>
          </div>
        </div>
        <div className="flex-1">
          <StudentSearchPanel allStudents={allStudents} today={today} mobile />
        </div>
      </div>
    );
  }

  // ── 반별 모드 - 화면 2: 학생 목록 ──
  if (selectedClassId !== null) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSelectedClassId(null)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            {selectedClass?.name}
          </button>
          <div className="flex-1" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-sm border border-input rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="px-4 py-2 border-b border-border">
          <button
            onClick={markAllPresent}
            disabled={students.length === 0}
            className="text-sm px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 transition-colors"
          >
            {students.length > 0 && students.every((s) => (pendingEdits.get(s.student_profile_id)?.status ?? s.status) === "present")
              ? "전원 출석 취소"
              : "전원 출석"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 pb-28 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : students.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-16">등록된 학생이 없습니다.</p>
          ) : (
            students.map((student) => {
              const { status: mergedStatus, note: mergedNote } = getMergedStatus(student.student_profile_id);
              const isPending = pendingEdits.has(student.student_profile_id);
              const showNote = mergedStatus === "absent" || mergedStatus === "late" || !!mergedNote;

              return (
                <div
                  key={student.student_profile_id}
                  className={`flex flex-col gap-2 p-3 rounded-xl border ${isPending ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground flex-1 truncate">
                      {student.korean_name ?? student.english_name ?? "이름 없음"}
                    </span>
                    <div className="flex gap-1 shrink-0">
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <button
                          key={key}
                          onClick={() => setStudentStatus(student.student_profile_id, key)}
                          className={`min-h-[44px] min-w-[44px] text-sm font-medium rounded-lg transition-all ${
                            mergedStatus === key ? cfg.active : cfg.inactive
                          }`}
                        >
                          {cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {showNote && (
                    <input
                      type="text"
                      value={mergedNote ?? ""}
                      placeholder="메모 (선택)"
                      onChange={(e) => setStudentNote(student.student_profile_id, e.target.value)}
                      className="text-sm border border-input rounded px-3 py-1.5 bg-background w-full focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {isDirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="fixed bottom-6 right-6 z-20 px-5 py-3 rounded-full bg-primary text-primary-foreground shadow-lg text-sm font-medium disabled:opacity-60 transition-opacity"
          >
            {saving ? "저장 중..." : `저장 (${pendingEdits.size}명)`}
          </button>
        )}
        {saveError && (
          <div className="fixed bottom-20 left-4 right-4 z-20 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 text-center">
            {saveError}
          </div>
        )}
      </div>
    );
  }

  // ── 반별 모드 - 화면 1: 반 선택 ──
  return (
    <div className="flex flex-col min-h-screen">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <h1 className="text-base font-semibold text-foreground flex-1">출결 관리</h1>
        <div className="flex gap-1 p-0.5 bg-muted rounded-lg">
          <button
            className="text-xs font-medium px-3 py-1 rounded-md bg-background text-foreground shadow-sm"
          >
            반별
          </button>
          <button
            onClick={() => setMode("student")}
            className="text-xs font-medium px-3 py-1 rounded-md text-muted-foreground hover:text-foreground"
          >
            학생 검색
          </button>
        </div>
      </div>

      <div className="px-4 pt-3 pb-2 flex items-center gap-3">
        <div className="flex gap-1 p-1 bg-muted rounded-lg flex-1">
          {GROUPS.map((g) => (
            <button
              key={g}
              onClick={() => setGroupFilter(g)}
              className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${
                groupFilter === g
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="text-sm border border-input rounded px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        {filteredClasses.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-16">등록된 반이 없습니다.</p>
        ) : (
          filteredClasses.map((cls) => (
            <button
              key={cls.id}
              onClick={() => setSelectedClassId(cls.id)}
              className="w-full text-left px-4 py-4 rounded-xl border border-border bg-card hover:bg-muted transition-colors min-h-[64px] flex flex-col justify-center"
            >
              <div className="text-sm font-semibold text-foreground">{cls.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5 flex gap-1 flex-wrap">
                {cls.teachers.map((t) => (
                  <span key={t.profile_id}>{t.name}</span>
                ))}
                <span>· 학생 {cls.student_count}명</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

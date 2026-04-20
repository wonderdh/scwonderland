"use client";

import { useState } from "react";
import { getAgeColor, getAgeLabel } from "@/lib/ui/student-age-colors";
import { useAttendanceEditor, type GroupFilter } from "../hooks/useAttendanceEditor";
import { StudentSearchPanel } from "./StudentSearchPanel";
import type { ClassWithDetails } from "@/lib/types";
import { formatStudentName } from "@/lib/utils/student-name";
import {
  ATTENDANCE_STATUS_CONFIG,
  ATTENDANCE_STATUSES,
  shouldShowNote,
  type AttendanceStatus,
} from "@/lib/constants/attendance";
import { LoadingState } from "@/components/feedback/LoadingState";
import { StatusBadge } from "@/components/badges/StatusBadge";

type StudentItem = {
  id: string;
  korean_name: string | null;
  english_name: string | null;
  age: number | null;
};

const GROUPS: GroupFilter[] = ["유치부", "오후반"];

type Mode = "class" | "student";

export function AdminAttendanceClient({
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
  } = useAttendanceEditor(initialClasses, today, true);

  const selectedClass = initialClasses.find((c) => c.id === selectedClassId);

  return (
    <div className="flex flex-col h-full">
      {/* 모드 토글 */}
      <div className="px-4 py-2 border-b border-border shrink-0">
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          {(["class", "student"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`text-xs font-medium px-4 py-1.5 rounded-md transition-colors ${
                mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "class" ? "반별" : "학생 검색"}
            </button>
          ))}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 flex min-h-0">
        {mode === "student" ? (
          <StudentSearchPanel allStudents={allStudents} today={today} />
        ) : (
          <>
            {/* 좌측 패널 */}
            <div className="w-64 shrink-0 border-r border-border flex flex-col bg-muted/30">
              <div className="p-4 border-b border-border space-y-3">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-sm border border-input rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="flex gap-1 p-1 bg-muted rounded-lg">
                  {GROUPS.map((g) => (
                    <button
                      key={g}
                      onClick={() => setGroupFilter(g)}
                      className={`flex-1 text-xs font-medium py-1 rounded-md transition-colors ${
                        groupFilter === g
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
                {filteredClasses.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">등록된 반이 없습니다</p>
                ) : (
                  filteredClasses.map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() => setSelectedClassId(cls.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        selectedClassId === cls.id
                          ? "bg-primary/10 ring-1 ring-primary text-primary"
                          : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <div className="font-medium truncate">{cls.name}</div>
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

            {/* 우측 패널 */}
            <div className="flex-1 flex flex-col min-h-0">
              {!selectedClassId ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-muted-foreground text-sm">좌측에서 반을 선택해 주세요.</p>
                </div>
              ) : (
                <>
                  <div className="px-6 py-4 border-b border-border shrink-0">
                    <h3 className="text-base font-semibold text-foreground">
                      {selectedClass?.name} — {date}
                    </h3>
                  </div>

                  <div className="flex-1 overflow-y-auto px-6 py-4 pb-24">
                    {loading ? (
                      <LoadingState label="반 출결 불러오는 중" />
                    ) : students.length === 0 ? (
                      <p className="text-muted-foreground text-base text-center py-12">등록된 학생이 없습니다.</p>
                    ) : (
                      <div className="space-y-2">
                        {students.map((student) => {
                          const ageColor = getAgeColor(student.age);
                          const { status: mergedStatus, note: mergedNote } = getMergedStatus(student.student_profile_id);
                          const isPending = pendingEdits.has(student.student_profile_id);
                          const showNote = shouldShowNote(mergedStatus) || !!mergedNote;

                          return (
                            <div
                              key={student.student_profile_id}
                              className={`flex flex-col gap-2 p-3 rounded-lg border ${isPending ? "border-primary/30 bg-primary/5" : "border-border bg-background"}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className={`text-sm px-2 py-0.5 rounded border font-medium shrink-0 ${ageColor.bg} ${ageColor.text} ${ageColor.border}`}>
                                    {getAgeLabel(student.age)}
                                  </span>
                                  <span className="text-base font-medium text-foreground truncate">
                                    {formatStudentName(student)}
                                  </span>
                                  {/* 저장된 출결 상태 배지 (편집 중이 아닐 때) */}
                                  {!isPending && mergedStatus && ATTENDANCE_STATUS_CONFIG[mergedStatus as AttendanceStatus] && (
                                    <StatusBadge
                                      size="sm"
                                      config={ATTENDANCE_STATUS_CONFIG[mergedStatus as AttendanceStatus]}
                                      className="shrink-0"
                                    />
                                  )}
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  {ATTENDANCE_STATUSES.map((key) => {
                                    const cfg = ATTENDANCE_STATUS_CONFIG[key];
                                    const Icon = cfg.icon;
                                    return (
                                      <button
                                        key={key}
                                        onClick={() => setStudentStatus(student.student_profile_id, key)}
                                        aria-label={cfg.label}
                                        title={cfg.label}
                                        className={`inline-flex items-center gap-1 text-sm px-2.5 py-1.5 rounded-md font-medium transition-all ${
                                          mergedStatus === key ? cfg.activeClass : cfg.inactiveClass
                                        }`}
                                      >
                                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                                        <span>{cfg.label}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              {showNote && (
                                <input
                                  type="text"
                                  value={mergedNote ?? ""}
                                  placeholder="메모 (선택)"
                                  onChange={(e) => setStudentNote(student.student_profile_id, e.target.value)}
                                  className="text-sm border border-input rounded px-2 py-1.5 bg-background w-full focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="sticky bottom-0 border-t border-border bg-background px-6 py-3 flex items-center justify-between shrink-0">
                    <button
                      onClick={markAllPresent}
                      disabled={students.length === 0}
                      className="text-sm px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 transition-colors"
                    >
                      {students.length > 0 && students.every((s) => (pendingEdits.get(s.student_profile_id)?.status ?? s.status) === "present")
                        ? "전원 출석 취소"
                        : "전원 출석"}
                    </button>
                    <div className="flex items-center gap-3">
                      {saveError && <span className="text-xs text-red-500">{saveError}</span>}
                      <button
                        onClick={handleSave}
                        disabled={!isDirty || saving || students.length === 0}
                        className="text-sm px-4 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors font-medium"
                      >
                        {saving ? "저장 중..." : `저장 (${pendingEdits.size}명)`}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

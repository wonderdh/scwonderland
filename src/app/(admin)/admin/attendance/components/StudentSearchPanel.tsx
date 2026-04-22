"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getAgeColor, getAgeLabel } from "@/lib/ui/student-age-colors";
import {
  getStudentAttendanceByDate,
  recordAttendance,
  bulkReserveAttendance,
} from "@/app/(admin)/admin/actions";
import { MultiDatePicker } from "@/components/forms/MultiDatePicker";
import { formatDateYmdKst, todayWeekdayArray } from "@/lib/utils/date-kst";
import {
  ATTENDANCE_STATUS_CONFIG,
  ATTENDANCE_STATUSES,
  type AttendanceStatus,
} from "@/lib/constants/attendance";
import { LoadingState } from "@/components/feedback/LoadingState";
import { formatStudentName } from "@/lib/utils/student-name";

type StudentItem = {
  id: string;
  korean_name: string | null;
  english_name: string | null;
  age: number | null;
};

export function StudentSearchPanel({
  allStudents,
  today,
  mobile = false,
}: {
  allStudents: StudentItem[];
  today: string;
  mobile?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);
  const [selectedDates, setSelectedDates] = useState<Date[]>(() => todayWeekdayArray());
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [currentNote, setCurrentNote] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [pendingNote, setPendingNote] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [saving, setSaving] = useState(false);

  // 클라이언트 타임존 기준 오늘 날짜로 초기화
  useEffect(() => {
    const localToday = new Date().toLocaleDateString("sv"); // YYYY-MM-DD
    const todayDate = new Date(localToday + "T00:00:00");
    // today prop과 다를 경우 클라이언트 타임존으로 덮어쓰기
    const initDate = new Date(today + "T00:00:00");
    if (localToday !== today) {
      setSelectedDates([todayDate]);
    } else {
      setSelectedDates([initDate]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredStudents = query.trim()
    ? allStudents.filter((s) => {
        const q = query.trim().toLowerCase();
        return (
          s.korean_name?.toLowerCase().includes(q) ||
          s.english_name?.toLowerCase().includes(q)
        );
      })
    : [];

  // 학생 또는 날짜(첫 번째) 변경 → 출결 상태 로드
  const primaryDate = selectedDates.length > 0 ? formatDateYmdKst(selectedDates[0]) : today;
  useEffect(() => {
    if (!selectedStudent) return;
    setLoadingStatus(true);
    setPendingStatus(null);
    setPendingNote(null);
    getStudentAttendanceByDate(selectedStudent.id, primaryDate).then(({ status, note }) => {
      setCurrentStatus(status);
      setCurrentNote(note);
      setLoadingStatus(false);
    });
   
  }, [selectedStudent, primaryDate]);

  function handleToggleStatus(status: string) {
    const active = pendingStatus ?? currentStatus;
    if (active === status) {
      setPendingStatus(null);
      setPendingNote(null);
    } else {
      setPendingStatus(status);
      if (status !== "absent" && status !== "early_leave" && status !== "late") setPendingNote(null);
    }
  }

  async function handleSave() {
    if (!selectedStudent) return;
    if (selectedDates.length === 0) { toast.error("날짜를 선택해 주세요."); return; }
    const status = pendingStatus ?? currentStatus;
    if (!status) { toast.error("출결 상태를 선택해 주세요."); return; }
    const note = (pendingNote ?? currentNote) ?? undefined;
    setSaving(true);
    let result: { error?: string };
    if (selectedDates.length === 1) {
      result = await recordAttendance(
        selectedStudent.id,
        formatDateYmdKst(selectedDates[0]),
        status,
        note
      );
    } else {
      result = await bulkReserveAttendance(
        selectedStudent.id,
        selectedDates.map((d) => formatDateYmdKst(d)),
        status,
        note
      );
    }
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      if (selectedDates.length === 1) {
        toast.success("출결이 저장되었습니다.");
        setCurrentStatus(status);
        setCurrentNote(pendingNote ?? currentNote);
        setPendingStatus(null);
        setPendingNote(null);
      } else {
        toast.success(`${selectedDates.length}일 출결이 일괄 저장되었습니다.`);
        setPendingStatus(null);
        setPendingNote(null);
      }
    }
  }

  function selectStudent(s: StudentItem) {
    setSelectedStudent(s);
    setSelectedDates(todayWeekdayArray());
    setQuery(formatStudentName(s, { fallback: "" }));
  }

  const activeStatus = pendingStatus ?? currentStatus;
  const activeNote = pendingNote !== null ? pendingNote : (currentNote ?? "");
  const isDirty = pendingStatus !== null;
  const showNote = activeStatus === "absent" || activeStatus === "late" || !!activeNote;
  const inputBase = "w-full h-11 text-base border border-input rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary";

  // ── 모바일 ──
  if (mobile) {
    return (
      <div className="flex flex-col h-full px-4 py-3 space-y-4">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedStudent(null); }}
            placeholder="학생 이름 검색..."
            className={inputBase}
            autoComplete="off"
          />
          {!selectedStudent && filteredStudents.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto">
              {filteredStudents.map((s) => {
                const c = getAgeColor(s.age);
                return (
                  <button
                    key={s.id}
                    onClick={() => selectStudent(s)}
                    className="w-full text-left px-3 py-2.5 hover:bg-muted flex items-center gap-2"
                  >
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium shrink-0 ${c.bg} ${c.text} ${c.border}`}>
                      {getAgeLabel(s.age)}
                    </span>
                    <span className="text-sm text-foreground">{s.korean_name}</span>
                    {s.english_name && <span className="text-xs text-muted-foreground">{s.english_name}</span>}
                  </button>
                );
              })}
            </div>
          )}
          {!selectedStudent && query.trim().length > 0 && filteredStudents.length === 0 && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-popover border border-border rounded-lg shadow-sm px-3 py-2 text-sm text-muted-foreground">
              검색 결과가 없습니다.
            </div>
          )}
        </div>

        {selectedStudent && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 border border-border">
              <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${getAgeColor(selectedStudent.age).bg} ${getAgeColor(selectedStudent.age).text} ${getAgeColor(selectedStudent.age).border}`}>
                {getAgeLabel(selectedStudent.age)}
              </span>
              <span className="font-semibold text-sm text-foreground flex-1">{selectedStudent.korean_name}</span>
              {selectedStudent.english_name && <span className="text-xs text-muted-foreground">{selectedStudent.english_name}</span>}
              <button onClick={() => { setSelectedStudent(null); setQuery(""); }} className="text-xs text-muted-foreground hover:text-foreground">변경</button>
            </div>

            <MultiDatePicker selected={selectedDates} onSelect={setSelectedDates} />

            {loadingStatus ? (
              <LoadingState label="출결 상태 불러오는 중" />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {ATTENDANCE_STATUSES.map((key) => {
                    const cfg = ATTENDANCE_STATUS_CONFIG[key];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={key}
                        onClick={() => handleToggleStatus(key)}
                        className={`min-h-[52px] inline-flex items-center justify-center gap-2 text-base font-medium rounded-xl transition-all ${activeStatus === key ? cfg.activeClass : cfg.inactiveClass}`}
                      >
                        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                        <span>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
                {showNote && (
                  <div className="space-y-1">
                    <p className="text-sm text-slate-500">
                      지각·조퇴·결석일 때 메모를 입력할 수 있습니다.
                    </p>
                    <input
                      type="text"
                      value={activeNote}
                      placeholder="메모 (선택)"
                      onChange={(e) => setPendingNote(e.target.value)}
                      className={inputBase}
                    />
                  </div>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving || !activeStatus}
                  className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-base font-medium disabled:opacity-40 transition-colors"
                >
                  {saving ? "저장 중..." : isDirty ? "저장" : "재저장"}
                </button>
              </>
            )}
          </div>
        )}

        {!selectedStudent && !query.trim() && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">학생 이름을 검색해 주세요.</p>
          </div>
        )}
      </div>
    );
  }

  // ── 데스크탑 ──
  return (
    <div className="flex h-full">
      <div className="w-64 shrink-0 border-r border-border flex flex-col bg-muted/30">
        <div className="p-4 border-b border-border">
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedStudent(null); }}
            placeholder="학생 이름 검색..."
            className={inputBase}
            autoComplete="off"
          />
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {query.trim() === "" ? (
            <p className="text-xs text-muted-foreground text-center py-6">이름을 입력해 주세요.</p>
          ) : filteredStudents.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">검색 결과가 없습니다.</p>
          ) : (
            filteredStudents.map((s) => {
              const c = getAgeColor(s.age);
              const isSelected = selectedStudent?.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => selectStudent(s)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2 transition-colors ${isSelected ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted"}`}
                >
                  <span className={`text-xs px-1.5 py-0.5 rounded border font-medium shrink-0 ${c.bg} ${c.text} ${c.border}`}>
                    {getAgeLabel(s.age)}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{s.korean_name}</div>
                    {s.english_name && <div className="text-xs text-muted-foreground truncate">{s.english_name}</div>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {!selectedStudent ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">좌측에서 학생을 선택해 주세요.</p>
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-border shrink-0 flex items-center gap-3">
              <span className={`text-sm px-2 py-0.5 rounded border font-medium ${getAgeColor(selectedStudent.age).bg} ${getAgeColor(selectedStudent.age).text} ${getAgeColor(selectedStudent.age).border}`}>
                {getAgeLabel(selectedStudent.age)}
              </span>
              <h3 className="text-base font-semibold text-foreground">{selectedStudent.korean_name}</h3>
              {selectedStudent.english_name && <span className="text-sm text-muted-foreground">{selectedStudent.english_name}</span>}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="flex items-start gap-3">
                <label className="text-base font-medium text-slate-700 w-16 shrink-0 pt-2">날짜</label>
                <MultiDatePicker selected={selectedDates} onSelect={setSelectedDates} />
              </div>

              <div className="flex items-start gap-3">
                <label className="text-base font-medium text-slate-700 w-16 shrink-0 pt-1.5">출결</label>
                {loadingStatus ? (
                  <LoadingState label="출결 상태 불러오는 중" className="py-4" />
                ) : (
                  <div className="space-y-2">
                    {/* 현재 저장된 상태 배지 */}
                    {currentStatus ? (
                      <div className={`inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-full ${ATTENDANCE_STATUS_CONFIG[currentStatus as AttendanceStatus]?.activeClass ?? ""}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                        저장됨: {ATTENDANCE_STATUS_CONFIG[currentStatus as AttendanceStatus]?.label}
                        {isDirty && <span className="opacity-60">→ 변경 중</span>}
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 text-sm text-muted-foreground px-2.5 py-1 rounded-full bg-muted/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                        기록 없음
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      {ATTENDANCE_STATUSES.map((key) => {
                        const cfg = ATTENDANCE_STATUS_CONFIG[key];
                        const Icon = cfg.icon;
                        return (
                          <button
                            key={key}
                            onClick={() => handleToggleStatus(key)}
                            className={`inline-flex items-center gap-2 text-base px-4 py-2 rounded-lg font-medium transition-all ${activeStatus === key ? cfg.activeClass : cfg.inactiveClass}`}
                          >
                            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                            <span>{cfg.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {showNote && (
                <div className="flex items-start gap-3">
                  <label className="text-base font-medium text-slate-700 w-16 shrink-0 pt-2">메모</label>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm text-slate-500">
                      지각·조퇴·결석일 때 메모를 입력할 수 있습니다.
                    </p>
                    <input
                      type="text"
                      value={activeNote}
                      placeholder="메모 (선택)"
                      onChange={(e) => setPendingNote(e.target.value)}
                      className="w-full h-11 text-base border border-input rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <div className="w-16 shrink-0" />
                <button
                  onClick={handleSave}
                  disabled={saving || !activeStatus || selectedDates.length === 0 || (selectedDates.length === 1 && !isDirty && !!currentStatus && activeStatus === currentStatus)}
                  className="h-11 text-base px-6 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors font-medium"
                >
                  {saving ? "저장 중..." : isDirty ? "저장" : "재저장"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

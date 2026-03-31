"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getAgeColor, getAgeLabel } from "@/lib/student-age-colors";
import {
  getStudentAttendanceByDate,
  recordAttendance,
} from "@/app/(admin)/admin/actions";

type StudentItem = {
  id: string;
  korean_name: string | null;
  english_name: string | null;
  age: number | null;
};

const STATUS_CONFIG: Record<string, { label: string; active: string; inactive: string }> = {
  present: {
    label: "출석",
    active: "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-400",
    inactive: "bg-gray-100 text-gray-500 hover:bg-emerald-50",
  },
  absent: {
    label: "결석",
    active: "bg-red-100 text-red-700 ring-2 ring-red-400",
    inactive: "bg-gray-100 text-gray-500 hover:bg-red-50",
  },
  late: {
    label: "지각",
    active: "bg-amber-100 text-amber-700 ring-2 ring-amber-400",
    inactive: "bg-gray-100 text-gray-500 hover:bg-amber-50",
  },
  excused: {
    label: "사유결석",
    active: "bg-blue-100 text-blue-700 ring-2 ring-blue-400",
    inactive: "bg-gray-100 text-gray-500 hover:bg-blue-50",
  },
};

const MOBILE_STATUS_CONFIG: Record<string, { label: string; active: string; inactive: string }> = {
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
  const [date, setDate] = useState(today);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [currentNote, setCurrentNote] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [pendingNote, setPendingNote] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [saving, setSaving] = useState(false);

  // 클라이언트 타임존 덮어쓰기
  useEffect(() => {
    const localToday = new Date().toLocaleDateString("sv");
    if (localToday !== date) setDate(localToday);
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

  // 학생 또는 날짜 변경 → 출결 상태 로드
  useEffect(() => {
    if (!selectedStudent) return;
    setLoadingStatus(true);
    setPendingStatus(null);
    setPendingNote(null);
    getStudentAttendanceByDate(selectedStudent.id, date).then(({ status, note }) => {
      setCurrentStatus(status);
      setCurrentNote(note);
      setLoadingStatus(false);
    });
  }, [selectedStudent, date]);

  function handleToggleStatus(status: string) {
    const active = pendingStatus ?? currentStatus;
    if (active === status) {
      setPendingStatus(null);
      setPendingNote(null);
    } else {
      setPendingStatus(status);
      if (status !== "absent" && status !== "excused" && status !== "late") setPendingNote(null);
    }
  }

  async function handleSave() {
    if (!selectedStudent) return;
    const status = pendingStatus ?? currentStatus;
    if (!status) { toast.error("출결 상태를 선택해 주세요."); return; }
    setSaving(true);
    const result = await recordAttendance(
      selectedStudent.id,
      date,
      status,
      (pendingNote ?? currentNote) ?? undefined
    );
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("출결이 저장되었습니다.");
      setCurrentStatus(status);
      setCurrentNote(pendingNote ?? currentNote);
      setPendingStatus(null);
      setPendingNote(null);
    }
  }

  function selectStudent(s: StudentItem) {
    setSelectedStudent(s);
    setQuery(s.korean_name ?? s.english_name ?? "");
  }

  const activeStatus = pendingStatus ?? currentStatus;
  const activeNote = pendingNote !== null ? pendingNote : (currentNote ?? "");
  const isDirty = pendingStatus !== null;
  const showNote = activeStatus === "absent" || activeStatus === "late" || !!activeNote;
  const inputBase = "w-full text-sm border border-input rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary";

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

            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputBase} />

            {loadingStatus ? (
              <div className="flex justify-center py-2">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(MOBILE_STATUS_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => handleToggleStatus(key)}
                      className={`min-h-[52px] text-sm font-medium rounded-xl transition-all ${activeStatus === key ? cfg.active : cfg.inactive}`}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
                {showNote && (
                  <input
                    type="text"
                    value={activeNote}
                    placeholder="메모 (선택)"
                    onChange={(e) => setPendingNote(e.target.value)}
                    className={inputBase}
                  />
                )}
                <button
                  onClick={handleSave}
                  disabled={saving || !activeStatus}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 transition-colors"
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
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground w-12 shrink-0">날짜</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="text-sm border border-input rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>

              <div className="flex items-start gap-3">
                <label className="text-sm text-muted-foreground w-12 shrink-0 pt-1.5">출결</label>
                {loadingStatus ? (
                  <div className="flex gap-2 flex-wrap">
                    {Object.keys(STATUS_CONFIG).map((key) => (
                      <div key={key} className="h-8 w-16 rounded-md bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* 현재 저장된 상태 배지 */}
                    {currentStatus ? (
                      <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_CONFIG[currentStatus]?.active ?? ""}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                        저장됨: {STATUS_CONFIG[currentStatus]?.label}
                        {isDirty && <span className="opacity-60">→ 변경 중</span>}
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground px-2.5 py-1 rounded-full bg-muted/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                        기록 없음
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <button
                          key={key}
                          onClick={() => handleToggleStatus(key)}
                          className={`text-sm px-3 py-1.5 rounded-md font-medium transition-all ${activeStatus === key ? cfg.active : cfg.inactive}`}
                        >
                          {cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {showNote && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-muted-foreground w-12 shrink-0">메모</label>
                  <input
                    type="text"
                    value={activeNote}
                    placeholder="메모 (선택)"
                    onChange={(e) => setPendingNote(e.target.value)}
                    className="flex-1 text-sm border border-input rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <div className="w-12 shrink-0" />
                <button
                  onClick={handleSave}
                  disabled={saving || !activeStatus || (!isDirty && !!currentStatus && activeStatus === currentStatus)}
                  className="text-sm px-5 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors font-medium"
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

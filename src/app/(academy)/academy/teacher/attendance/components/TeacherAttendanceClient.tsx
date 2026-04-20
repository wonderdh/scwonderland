"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getClassAttendanceByDate,
  recordAttendance,
} from "@/app/(admin)/admin/actions";
import { toast } from "sonner";
import { attendanceLabels } from "@/lib/ui/teacher-labels";
import { LoadingState } from "@/components/feedback/LoadingState";
import { Spinner } from "@/components/feedback/Spinner";
import { Button } from "@/components/ui/button";
import {
  ATTENDANCE_STATUS_CONFIG,
  ATTENDANCE_STATUSES,
  type AttendanceStatus,
} from "@/lib/constants/attendance";
import { formatStudentName } from "@/lib/utils/student-name";

type TeacherClass = { id: string; name: string };
type StudentInfo = {
  profile_id: string;
  korean_name: string | null;
  english_name: string | null;
  student_number: string | null;
};
type ClassWithStudents = TeacherClass & { students: StudentInfo[] };

export function TeacherAttendanceClient({
  classes,
  teacherType,
}: {
  classes: ClassWithStudents[];
  teacherType: "korean" | "native";
}) {
  const L = attendanceLabels[teacherType];
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id ?? "");
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus | null>>({});
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const students = selectedClass?.students ?? [];

  const loadAttendance = useCallback(async () => {
    if (!selectedClassId) return;
    setLoading(true);
    setError(null);
    const records = await getClassAttendanceByDate(selectedClassId, today);
    const sMap: Record<string, AttendanceStatus | null> = {};
    const nMap: Record<string, string> = {};
    for (const r of records) {
      sMap[r.studentProfileId] = (r.status as AttendanceStatus) ?? null;
      nMap[r.studentProfileId] = r.note ?? "";
    }
    setStatusMap(sMap);
    setNoteMap(nMap);
    setSavedIds(new Set());
    setLoading(false);
  }, [selectedClassId, today]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setStatusMap((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === status ? null : status,
    }));
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.delete(studentId);
      return next;
    });
  };

  const handleSave = async (studentId: string) => {
    const status = statusMap[studentId];
    if (!status) return;
    setSaving(studentId);
    setError(null);
    const result = await recordAttendance(
      studentId,
      today,
      status,
      noteMap[studentId] || undefined
    );
    setSaving(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    toast.success("출결이 저장되었습니다.");
    setSavedIds((prev) => new Set(prev).add(studentId));
  };

  const handleAllPresent = async () => {
    setSaving("all");
    setError(null);
    for (const s of students) {
      const result = await recordAttendance(
        s.profile_id,
        today,
        "present"
      );
      if (result.error) {
        setError(result.error);
        setSaving(null);
        return;
      }
      setStatusMap((prev) => ({ ...prev, [s.profile_id]: "present" }));
      setSavedIds((prev) => new Set(prev).add(s.profile_id));
    }
    toast.success("출결이 저장되었습니다.");
    setSaving(null);
  };

  if (classes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/30 p-12 text-center">
        <p className="text-sm text-muted-foreground">{L.noClasses}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 반 선택 + 날짜 표시 */}
      <div className="flex items-center justify-between gap-3">
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="min-h-[44px] rounded-lg border border-input px-3 py-2 text-sm bg-background sm:min-h-0"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-muted px-3 py-1.5 text-sm font-medium text-foreground">
            {L.today}: {today}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px] sm:min-h-[36px]"
            onClick={handleAllPresent}
            disabled={saving !== null || students.length === 0}
          >
            {saving === "all" ? <><Spinner size="sm" /> {L.saving}</> : L.allPresent}
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {loading ? (
        <LoadingState label={L.loading} />
      ) : students.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-12 text-center">
          <p className="text-sm text-muted-foreground">{L.noStudents}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {students.map((s) => {
            const currentStatus = statusMap[s.profile_id];
            const isSaved = savedIds.has(s.profile_id);
            const isSaving = saving === s.profile_id;
            const displayName = formatStudentName(s, {
              preferEnglish: teacherType === "native",
              fallback: "—",
            });

            return (
              <li key={s.profile_id} className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{displayName}</span>
                    {s.student_number && (
                      <span className="text-xs text-muted-foreground">#{s.student_number}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isSaved && (
                      <span className="text-xs text-emerald-600 font-medium">{L.saved}</span>
                    )}
                    <Button
                      size="sm"
                      variant={isSaved ? "outline" : "default"}
                      className="min-h-[36px]"
                      onClick={() => handleSave(s.profile_id)}
                      disabled={!currentStatus || isSaving || saving === "all"}
                    >
                      {isSaving ? <><Spinner size="sm" /> {L.saving}</> : L.save}
                    </Button>
                  </div>
                </div>

                {/* 출결 상태 버튼 */}
                <div className="flex gap-1.5">
                  {ATTENDANCE_STATUSES.map((st) => {
                    const isActive = currentStatus === st;
                    const cfg = ATTENDANCE_STATUS_CONFIG[st];
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleStatusChange(s.profile_id, st)}
                        disabled={saving !== null}
                        className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-all ${
                          isActive ? cfg.activeClass : cfg.inactiveClass
                        }`}
                      >
                        {L[st]}
                      </button>
                    );
                  })}
                </div>

                {/* 메모 (결석/지각/사유 선택 시) */}
                {currentStatus && currentStatus !== "present" && (
                  <input
                    type="text"
                    placeholder={L.notePlaceholder}
                    value={noteMap[s.profile_id] ?? ""}
                    onChange={(e) =>
                      setNoteMap((prev) => ({ ...prev, [s.profile_id]: e.target.value }))
                    }
                    className="w-full min-h-[40px] rounded-lg border border-input px-3 py-2 text-sm bg-background"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

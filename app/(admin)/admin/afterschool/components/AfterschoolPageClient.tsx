"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getAgeColor } from "@/lib/student-age-colors";
import {
  enrollStudent,
  removeAfterschoolStudent,
  bulkUpdateEnrollmentDays,
} from "../../actions";
import type { AfterschoolStudentEnrollment } from "../../actions/afterschool-actions";
import { Spinner } from "@/components/Spinner";

const DAY_LABELS = ["월", "화", "수", "목", "금"];

type StudentOption = { id: string; korean_name: string | null; english_name: string | null; age: number | null };
type LocalEnrollment = AfterschoolStudentEnrollment & { _dirty?: boolean };

export function AfterschoolPageClient({
  classId,
  initialEnrollments,
  initialAvailable,
}: {
  classId: string;
  initialEnrollments: AfterschoolStudentEnrollment[];
  initialAvailable: StudentOption[];
}) {
  const router = useRouter();
  const [students, setStudents] = useState<LocalEnrollment[]>(
    initialEnrollments.map((s) => ({ ...s, _dirty: false })),
  );
  const [available, setAvailable] = useState(initialAvailable);

  // 학생 추가
  const [enrollStudentId, setEnrollStudentId] = useState("");
  const [enrollDays, setEnrollDays] = useState<number[]>([]);
  const [enrolling, setEnrolling] = useState(false);

  // 일괄 저장
  const hasDirty = students.some((s) => s._dirty);
  const [bulkSaving, setBulkSaving] = useState(false);

  const refresh = useCallback(() => router.refresh(), [router]);

  // 학생 등록
  const handleEnroll = async () => {
    if (!enrollStudentId || !enrollDays.length) return;
    setEnrolling(true);
    try {
      const result = await enrollStudent(classId, enrollStudentId, enrollDays);
      if (result.error) { toast.error(result.error); return; }
      toast.success("등록되었습니다.");
      setEnrollStudentId("");
      setEnrollDays([]);
      refresh();
    } finally {
      setEnrolling(false);
    }
  };

  // 학생 제거
  const handleRemove = async (studentProfileId: string) => {
    if (!confirm("이 학생을 제거하시겠습니까?")) return;
    const result = await removeAfterschoolStudent(classId, studentProfileId);
    if (result.error) { toast.error(result.error); return; }
    toast.success("제거되었습니다.");
    refresh();
  };

  // 요일 토글 (로컬)
  const toggleDay = (studentProfileId: string, day: number) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.student_profile_id !== studentProfileId) return s;
        const newDays = s.days.includes(day)
          ? s.days.filter((d) => d !== day)
          : [...s.days, day].sort();
        return { ...s, days: newDays, _dirty: true };
      }),
    );
  };

  // 일괄 저장
  const handleBulkSave = async () => {
    setBulkSaving(true);
    try {
      const updates = students
        .filter((s) => s._dirty)
        .map((s) => ({ studentProfileId: s.student_profile_id, days: s.days }));
      const result = await bulkUpdateEnrollmentDays(classId, updates);
      if (result.error) { toast.error(result.error); return; }
      toast.success("저장되었습니다.");
      refresh();
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">방과후 관리</h1>

      {/* 학생 추가 */}
      <div className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold mb-3">학생 등록</h2>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-muted-foreground mb-1 block">학생</label>
            <select
              value={enrollStudentId}
              onChange={(e) => setEnrollStudentId(e.target.value)}
              className="w-full rounded-lg border border-input px-3 py-1.5 text-sm bg-background"
            >
              <option value="">학생 선택...</option>
              {available.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.korean_name ?? s.english_name ?? "—"}{s.age ? ` (${s.age}세)` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">요일</label>
            <div className="flex gap-1">
              {DAY_LABELS.map((label, idx) => {
                const day = idx + 1;
                const checked = enrollDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() =>
                      setEnrollDays((prev) =>
                        checked ? prev.filter((d) => d !== day) : [...prev, day].sort(),
                      )
                    }
                    className={`w-8 h-8 rounded-md text-xs font-medium transition-colors ${
                      checked
                        ? "bg-violet-600 text-white"
                        : "bg-muted text-muted-foreground hover:bg-violet-100"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            onClick={handleEnroll}
            disabled={enrolling || !enrollStudentId || !enrollDays.length}
            className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {enrolling ? <Spinner /> : "등록"}
          </button>
        </div>
      </div>

      {/* 저장 바 */}
      {hasDirty && (
        <div className="flex items-center justify-between rounded-lg bg-violet-50 border border-violet-200 px-4 py-2">
          <span className="text-sm text-violet-700 font-medium">변경사항이 있습니다.</span>
          <button
            onClick={handleBulkSave}
            disabled={bulkSaving}
            className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {bulkSaving ? <Spinner /> : "일괄 저장"}
          </button>
        </div>
      )}

      {/* 등록 학생 테이블 */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">이름</th>
              {DAY_LABELS.map((label, idx) => (
                <th key={idx} className="px-3 py-2.5 text-center font-medium text-muted-foreground w-14">
                  {label}
                </th>
              ))}
              <th className="px-3 py-2.5 text-center font-medium text-muted-foreground w-12" />
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-muted-foreground">
                  등록된 학생이 없습니다.
                </td>
              </tr>
            ) : (
              students.map((s) => {
                const ageColor = getAgeColor(s.age);
                return (
                  <tr key={s.student_profile_id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${ageColor.bg} ${ageColor.text}`}
                      >
                        {s.korean_name ?? s.english_name ?? "—"}
                        {s.age ? ` (${s.age}세)` : ""}
                      </span>
                    </td>
                    {DAY_LABELS.map((_, idx) => {
                      const day = idx + 1;
                      const checked = s.days.includes(day);
                      return (
                        <td key={day} className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleDay(s.student_profile_id, day)}
                            className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                          />
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => handleRemove(s.student_profile_id)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                        title="제거"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

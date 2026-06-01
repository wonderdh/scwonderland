"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { getClassStudentsWithAttendance, bulkRecordAttendance } from "@/app/(admin)/admin/actions/attendance-actions";
import type { ClassWithDetails, StudentWithAttendance } from "@/lib/types";
import { GROUP_TYPE_TO_LABEL } from "@/lib/constants/class";

export type GroupFilter = "유치부" | "오후반";

export function useAttendanceEditor(initialClasses: ClassWithDetails[], today: string, autoSelectFirst = false) {
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("유치부");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [students, setStudents] = useState<StudentWithAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<Map<string, { status: string; note: string | null }>>(new Map());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 클라이언트 타임존으로 오늘 날짜 덮어쓰기
  useEffect(() => {
    const localToday = new Date().toLocaleDateString("sv");
    if (localToday !== date) setDate(localToday);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredClasses = initialClasses.filter((c) => (GROUP_TYPE_TO_LABEL[c.group_type ?? ""] ?? "") === groupFilter);

  // 그룹 변경 시 현재 선택 반이 해당 그룹에 없으면 처리
  useEffect(() => {
    const inGroup = filteredClasses.find((c) => c.id === selectedClassId);
    if (!inGroup) {
      // autoSelectFirst=true 이면 첫 번째 반 자동 선택, 아니면 초기화
      setSelectedClassId(autoSelectFirst ? (filteredClasses[0]?.id ?? null) : null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupFilter]);

  const loadStudents = useCallback(async (classId: string, d: string) => {
    setLoading(true);
    const data = await getClassStudentsWithAttendance(classId, d);
    setStudents(data);
    setLoading(false);
  }, []);

  // selectedClassId 또는 date 변경 시 데이터 로드 + pendingEdits 초기화
  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      return;
    }
    setPendingEdits(new Map());
    setSaveError(null);
    loadStudents(selectedClassId, date);
  }, [selectedClassId, date, loadStudents]);

  function setStudentStatus(profileId: string, status: string) {
    setPendingEdits((prev) => {
      const next = new Map(prev);
      const currentStatus = next.get(profileId)?.status
        ?? students.find((s) => s.student_profile_id === profileId)?.status
        ?? null;
      // 같은 상태 다시 클릭 → 해제 (pendingEdits에서 제거)
      if (currentStatus === status) {
        next.delete(profileId);
        return next;
      }
      const existing = next.get(profileId);
      next.set(profileId, { status, note: existing?.note ?? null });
      return next;
    });
  }

  function setStudentNote(profileId: string, note: string) {
    setPendingEdits((prev) => {
      const next = new Map(prev);
      const existing = next.get(profileId);
      if (!existing) return prev; // 상태 미설정 시 메모만 변경 불가
      next.set(profileId, { status: existing.status, note: note || null });
      return next;
    });
  }

  function markAllPresent() {
    setPendingEdits((prev) => {
      // 모든 학생이 이미 출석이면 → 전원 취소(pending 제거)
      const allPresent = students.every((s) => {
        const merged = prev.get(s.student_profile_id)?.status ?? s.status;
        return merged === "present";
      });
      if (allPresent) {
        const next = new Map(prev);
        for (const s of students) next.delete(s.student_profile_id);
        return next;
      }
      const next = new Map(prev);
      for (const s of students) {
        next.set(s.student_profile_id, { status: "present", note: null });
      }
      return next;
    });
  }

  function getMergedStatus(profileId: string): { status: string | null; note: string | null } {
    const pending = pendingEdits.get(profileId);
    if (pending) return pending;
    const server = students.find((s) => s.student_profile_id === profileId);
    return { status: server?.status ?? null, note: server?.note ?? null };
  }

  async function handleSave() {
    if (!selectedClassId || pendingEdits.size === 0) return;
    setSaving(true);
    setSaveError(null);

    const records = Array.from(pendingEdits.entries()).map(([profileId, { status, note }]) => ({
      student_profile_id: profileId,
      date,
      status,
      note,
    }));

    const result = await bulkRecordAttendance(records);
    setSaving(false);

    if (result.error) {
      setSaveError(result.error);
      toast.error(result.error);
    } else {
      toast.success(`${records.length}명 출결이 저장되었습니다.`);
      setPendingEdits(new Map());
      loadStudents(selectedClassId, date);
    }
  }

  const isDirty = pendingEdits.size > 0;

  return {
    groupFilter,
    setGroupFilter,
    selectedClassId,
    setSelectedClassId,
    date,
    setDate,
    students,
    loading,
    pendingEdits,
    saving,
    saveError,
    isDirty,
    filteredClasses,
    setStudentStatus,
    setStudentNote,
    markAllPresent,
    getMergedStatus,
    handleSave,
  };
}

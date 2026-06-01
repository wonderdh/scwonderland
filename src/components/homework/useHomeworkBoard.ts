"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  listSeriesLevelProgress,
  bulkMarkUnits,
  getAbsentStudentIds,
  type BoardStudent,
  type StudentTextbookUnits,
  type UnitStatus,
  type SeriesLevelProgress,
} from "@/app/(admin)/admin/actions/homework-unit-actions";

const NEXT_STATUS: Record<UnitStatus, UnitStatus> = {
  pending: "completed",
  completed: "missed",
  missed: "pending",
};

/** key = `${studentId}:${textbookId}:${unitNumber}` */
type PendingKey = string;

export type UseHomeworkBoard = {
  seriesId: string | null;
  level: string | null;
  search: string;
  students: BoardStudent[];
  byStudent: Record<string, StudentTextbookUnits[]>;
  filteredStudents: BoardStudent[];
  absentStudentIds: ReadonlySet<string>;
  pendingCount: number;
  isLoading: boolean;
  isSaving: boolean;
  selectStpoint: (seriesId: string | null, level: string | null) => void;
  setSearch: (q: string) => void;
  unitClick: (studentId: string, textbookId: string, unitNumber: number) => void;
  dirtyNumbers: (studentId: string, textbookId: string) => Set<number>;
  save: () => Promise<void>;
  cancel: () => void;
};

export function useHomeworkBoard(todayKst: string): UseHomeworkBoard {
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [data, setData] = useState<SeriesLevelProgress>({ students: [], byStudent: {} });
  const [local, setLocal] = useState<Record<string, StudentTextbookUnits[]>>({});
  const [pending, setPending] = useState<Map<PendingKey, UnitStatus>>(new Map());
  const [absentStudentIds, setAbsent] = useState<ReadonlySet<string>>(new Set());
  const [isLoading, startLoad] = useTransition();
  const [isSaving, setIsSaving] = useState(false);

  // 시리즈/레벨 바뀌면 데이터 재로드 + 편집상태 초기화
  useEffect(() => {
    if (!seriesId) {
      setData({ students: [], byStudent: {} });
      setLocal({});
      setPending(new Map());
      return;
    }
    startLoad(async () => {
      const [next, absentResult] = await Promise.all([
        listSeriesLevelProgress(seriesId, level ?? undefined),
        getAbsentStudentIds(todayKst),
      ]);
      if (next.error) toast.error(next.error);
      setData(next);
      setLocal(next.byStudent);
      setPending(new Map());
      setAbsent(new Set(absentResult.studentIds));
    });
  }, [seriesId, level, todayKst]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.students;
    return data.students.filter((s) => {
      const hay = `${s.english_name ?? ""} ${s.korean_name ?? ""} ${s.className}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data.students, search]);

  const selectStpoint = useCallback((sid: string | null, lv: string | null) => {
    setSeriesId(sid);
    setLevel(lv);
    setSearch("");
  }, []);

  const unitClick = useCallback(
    (studentId: string, textbookId: string, unitNumber: number) => {
      if (absentStudentIds.has(studentId)) {
        toast.warning("결석 학생입니다. 저장 시 자동 제외됩니다.");
      }
      setLocal((prev) => {
        const list = prev[studentId];
        if (!list) return prev;
        const cur = list.find((t) => t.id === textbookId)?.units.find((u) => u.unitNumber === unitNumber);
        if (!cur) return prev;
        const nextStatus = NEXT_STATUS[cur.status];
        // pending map 갱신
        setPending((pm) => {
          const nm = new Map(pm);
          const key = `${studentId}:${textbookId}:${unitNumber}`;
          const original = data.byStudent[studentId]
            ?.find((t) => t.id === textbookId)
            ?.units.find((u) => u.unitNumber === unitNumber);
          if (original && original.status === nextStatus) nm.delete(key);
          else nm.set(key, nextStatus);
          return nm;
        });
        return {
          ...prev,
          [studentId]: list.map((t) =>
            t.id !== textbookId
              ? t
              : {
                  ...t,
                  units: t.units.map((u) =>
                    u.unitNumber !== unitNumber ? u : { ...u, status: nextStatus }
                  ),
                }
          ),
        };
      });
    },
    [absentStudentIds, data.byStudent]
  );

  const dirtyNumbers = useCallback(
    (studentId: string, textbookId: string) =>
      new Set(
        [...pending.keys()]
          .filter((k) => k.startsWith(`${studentId}:${textbookId}:`))
          .map((k) => Number(k.split(":")[2]))
      ),
    [pending]
  );

  const cancel = useCallback(() => {
    setLocal(data.byStudent);
    setPending(new Map());
  }, [data.byStudent]);

  const save = useCallback(async () => {
    if (pending.size === 0 || isSaving) return;
    const records: { studentId: string; textbookId: string; unitNumber: number; status: UnitStatus }[] = [];
    for (const [key, status] of pending) {
      const i1 = key.indexOf(":");
      const i2 = key.indexOf(":", i1 + 1);
      records.push({
        studentId: key.slice(0, i1),
        textbookId: key.slice(i1 + 1, i2),
        unitNumber: Number(key.slice(i2 + 1)),
        status,
      });
    }
    setIsSaving(true);
    try {
      const result = await bulkMarkUnits(records, { excludeAbsentOn: todayKst });
      if (result.error) {
        toast.error(result.error);
        setLocal(data.byStudent); // 롤백
        return;
      }
      const parts = [`저장 ${result.saved}건`];
      if (result.skippedAbsent > 0) parts.push(`결석자 ${result.skippedAbsent}건 제외`);
      toast.success(parts.join(" · "));
      // 저장 성공분을 baseline 에 반영
      setData((prev) => ({ ...prev, byStudent: local }));
      setPending(new Map());
    } finally {
      setIsSaving(false);
    }
  }, [pending, isSaving, todayKst, data.byStudent, local]);

  return {
    seriesId,
    level,
    search,
    students: data.students,
    byStudent: local,
    filteredStudents,
    absentStudentIds,
    pendingCount: pending.size,
    isLoading,
    isSaving,
    selectStpoint,
    setSearch,
    unitClick,
    dirtyNumbers,
    save,
    cancel,
  };
}

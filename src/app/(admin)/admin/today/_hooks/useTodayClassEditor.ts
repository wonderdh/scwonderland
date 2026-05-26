"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  listClassUnitProgressDetailed,
  getClassStudentsWithAttendance,
  bulkMarkUnits,
  bulkRecordAttendance,
} from "@/app/(admin)/admin/actions";
import type {
  HomeworkClassPickerOption,
  ClassUnitProgressDetailed,
  UnitStatus,
} from "@/app/(admin)/admin/actions";
import type { StudentWithAttendance } from "@/lib/types";
import type { AttendanceStatus } from "@/lib/constants/attendance";

export type GroupFilter = "유치부" | "오후반";

const GROUP_TO_TYPE: Record<GroupFilter, string> = {
  유치부: "kindergarten",
  오후반: "afternoon",
};

const NEXT_UNIT_STATUS: Record<UnitStatus, UnitStatus> = {
  pending: "completed",
  completed: "missed",
  missed: "pending",
};

export type TodayPeriodOption = { id: string; label: string; startTime: string };

/** 펼친 반의 학생 1명 — 숙제 진도 + 출결을 student_id 로 조인한 결과. */
export type TodayStudent = {
  /** progress students[].id === student_id */
  studentId: string;
  /** 출결 mutation 키. */
  studentProfileId: string | null;
  koreanName: string | null;
  englishName: string | null;
  /** byStudent[studentId] — UnitProgressGrid 에 그대로 전달 가능. */
  books: ClassUnitProgressDetailed["byStudent"][string];
};

/** 반별 lazy 캐시 데이터. */
type ClassCache = {
  students: TodayStudent[];
  /** 서버에서 온 출결 상태 (student_id → status). */
  serverAttendance: Map<string, AttendanceStatus | null>;
};

/** 출결 pending 변경: student_id → { profileId, status }. status=null 은 해제. */
type AttendanceEdit = { studentProfileId: string; status: AttendanceStatus | null };

function findFirstAfternoonPeriodId(periods: TodayPeriodOption[]): string {
  // 2:50 (14:50) 우선, 없으면 가장 이른 시작 시간.
  for (const p of periods) {
    if (p.label.includes("2:50") || p.startTime.startsWith("14:50")) return p.id;
  }
  return periods[0]?.id ?? "";
}

export function useTodayClassEditor(props: {
  classes: HomeworkClassPickerOption[];
  todayKst: string;
  todayDow: number;
  initialAbsentStudentIds: string[];
}) {
  const { classes, todayKst, todayDow } = props;

  // ── 필터 상태 ──────────────────────────────────────────────────────────────
  const availablePeriods = useMemo<TodayPeriodOption[]>(() => {
    const map = new Map<string, TodayPeriodOption>();
    for (const c of classes) {
      if (c.groupType !== "afternoon") continue;
      if (!c.periodId || !c.periodLabel || !c.periodStartTime) continue;
      if (!map.has(c.periodId)) {
        map.set(c.periodId, {
          id: c.periodId,
          label: c.periodLabel,
          startTime: c.periodStartTime,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [classes]);

  const defaultPeriodId = useMemo(
    () => findFirstAfternoonPeriodId(availablePeriods),
    [availablePeriods]
  );

  const [group, setGroup] = useState<GroupFilter>("오후반");
  const [day, setDay] = useState<number>(todayDow);
  const [periodId, setPeriodId] = useState<string>(defaultPeriodId);
  const [date, setDate] = useState<string>(todayKst);

  const filteredClasses = useMemo(() => {
    const wantType = GROUP_TO_TYPE[group];
    return classes.filter((c) => {
      if (c.groupType !== wantType) return false;
      if (!c.daysOfWeek.includes(day)) return false;
      if (periodId !== "" && c.periodId !== periodId) return false;
      return true;
    });
  }, [classes, group, day, periodId]);

  // ── 반별 lazy 캐시 + pending 변경 ───────────────────────────────────────────
  const [cache, setCache] = useState<Map<string, ClassCache>>(new Map());
  const [loadingClasses, setLoadingClasses] = useState<Set<string>>(new Set());
  const [savingClasses, setSavingClasses] = useState<Set<string>>(new Set());

  // 출결 pending: classId → (student_id → AttendanceEdit)
  const [attendanceEdits, setAttendanceEdits] = useState<
    Map<string, Map<string, AttendanceEdit>>
  >(new Map());
  // 숙제 pending: classId → (key "studentId:textbookId:unitNumber" → UnitStatus)
  const [unitEdits, setUnitEdits] = useState<Map<string, Map<string, UnitStatus>>>(
    new Map()
  );

  // 초기 결석 set (student_id) — 펼치기 전에도 카드 요약에 활용 가능.
  const [initialAbsent] = useState<ReadonlySet<string>>(
    () => new Set(props.initialAbsentStudentIds)
  );

  const loadClass = useCallback(
    async (classId: string) => {
      setLoadingClasses((prev) => new Set(prev).add(classId));
      try {
        const [progress, attendance] = await Promise.all([
          listClassUnitProgressDetailed(classId),
          getClassStudentsWithAttendance(classId, date),
        ]);

        // 출결을 student_id 기준으로 색인 (조인 키).
        const attByStudentId = new Map<string, StudentWithAttendance>();
        const profileByStudentId = new Map<string, string>();
        for (const a of attendance) {
          if (a.student_id) {
            attByStudentId.set(a.student_id, a);
            profileByStudentId.set(a.student_id, a.student_profile_id);
          }
        }

        const serverAttendance = new Map<string, AttendanceStatus | null>();
        const students: TodayStudent[] = progress.students.map((s) => {
          const att = attByStudentId.get(s.id);
          serverAttendance.set(s.id, (att?.status as AttendanceStatus | null) ?? null);
          return {
            studentId: s.id,
            studentProfileId: profileByStudentId.get(s.id) ?? null,
            koreanName: s.korean_name,
            englishName: s.english_name,
            books: progress.byStudent[s.id] ?? [],
          };
        });

        setCache((prev) => {
          const next = new Map(prev);
          next.set(classId, { students, serverAttendance });
          return next;
        });
        // 재조회 시 pending 초기화.
        setAttendanceEdits((prev) => {
          const next = new Map(prev);
          next.delete(classId);
          return next;
        });
        setUnitEdits((prev) => {
          const next = new Map(prev);
          next.delete(classId);
          return next;
        });
      } finally {
        setLoadingClasses((prev) => {
          const next = new Set(prev);
          next.delete(classId);
          return next;
        });
      }
    },
    [date]
  );

  // ── merged 조회 헬퍼 ────────────────────────────────────────────────────────
  const getMergedAttendance = useCallback(
    (classId: string, studentId: string): AttendanceStatus | null => {
      const edit = attendanceEdits.get(classId)?.get(studentId);
      if (edit) return edit.status;
      return cache.get(classId)?.serverAttendance.get(studentId) ?? null;
    },
    [attendanceEdits, cache]
  );

  /** 이 반에서 현재 결석으로 표시된 student_id 집합 (서버+pending merged). */
  const absentStudentIds = useCallback(
    (classId: string): ReadonlySet<string> => {
      const set = new Set<string>();
      const c = cache.get(classId);
      if (!c) return set;
      for (const s of c.students) {
        if (getMergedAttendance(classId, s.studentId) === "absent") set.add(s.studentId);
      }
      return set;
    },
    [cache, getMergedAttendance]
  );

  const getMergedUnitStatus = useCallback(
    (
      classId: string,
      studentId: string,
      textbookId: string,
      unitNumber: number,
      original: UnitStatus
    ): UnitStatus => {
      const key = `${studentId}:${textbookId}:${unitNumber}`;
      return unitEdits.get(classId)?.get(key) ?? original;
    },
    [unitEdits]
  );

  /** 한 책의 dirty unit 번호 집합 — UnitProgressGrid dirtyNumbers 용. */
  const dirtyUnitNumbers = useCallback(
    (classId: string, studentId: string, textbookId: string): Set<number> => {
      const m = unitEdits.get(classId);
      const out = new Set<number>();
      if (!m) return out;
      const prefix = `${studentId}:${textbookId}:`;
      for (const key of m.keys()) {
        if (key.startsWith(prefix)) out.add(Number(key.slice(prefix.length)));
      }
      return out;
    },
    [unitEdits]
  );

  // ── mutations (로컬) ────────────────────────────────────────────────────────
  const setAttendance = useCallback(
    (classId: string, studentProfileId: string, status: AttendanceStatus) => {
      const c = cache.get(classId);
      if (!c) return;
      const student = c.students.find((s) => s.studentProfileId === studentProfileId);
      if (!student) return;
      const studentId = student.studentId;
      const serverStatus = c.serverAttendance.get(studentId) ?? null;
      const current = getMergedAttendance(classId, studentId);
      // 활성 상태 다시 클릭 → 해제.
      const nextStatus: AttendanceStatus | null = current === status ? null : status;

      setAttendanceEdits((prev) => {
        const next = new Map(prev);
        const inner = new Map(next.get(classId) ?? []);
        if (nextStatus === serverStatus) {
          inner.delete(studentId);
        } else {
          inner.set(studentId, { studentProfileId, status: nextStatus });
        }
        if (inner.size === 0) next.delete(classId);
        else next.set(classId, inner);
        return next;
      });
    },
    [cache, getMergedAttendance]
  );

  const cycleUnit = useCallback(
    (classId: string, studentId: string, textbookId: string, unitNumber: number) => {
      // 결석 학생은 무시.
      if (absentStudentIds(classId).has(studentId)) return;
      const c = cache.get(classId);
      if (!c) return;
      const student = c.students.find((s) => s.studentId === studentId);
      const book = student?.books.find((b) => b.id === textbookId);
      const unit = book?.units.find((u) => u.unitNumber === unitNumber);
      if (!unit) return;
      const original = unit.status;
      const key = `${studentId}:${textbookId}:${unitNumber}`;

      setUnitEdits((prev) => {
        const next = new Map(prev);
        const inner = new Map(next.get(classId) ?? []);
        const current = inner.get(key) ?? original;
        const nextStatus = NEXT_UNIT_STATUS[current];
        if (nextStatus === original) inner.delete(key);
        else inner.set(key, nextStatus);
        if (inner.size === 0) next.delete(classId);
        else next.set(classId, inner);
        return next;
      });
    },
    [absentStudentIds, cache]
  );

  const pendingCount = useCallback(
    (classId: string): number => {
      const att = attendanceEdits.get(classId)?.size ?? 0;
      const unit = unitEdits.get(classId)?.size ?? 0;
      return att + unit;
    },
    [attendanceEdits, unitEdits]
  );

  const cancelClass = useCallback((classId: string) => {
    setAttendanceEdits((prev) => {
      const next = new Map(prev);
      next.delete(classId);
      return next;
    });
    setUnitEdits((prev) => {
      const next = new Map(prev);
      next.delete(classId);
      return next;
    });
  }, []);

  const saveClass = useCallback(
    async (classId: string) => {
      if (pendingCount(classId) === 0) return;
      setSavingClasses((prev) => new Set(prev).add(classId));
      try {
        // 1. 출결 저장.
        const attMap = attendanceEdits.get(classId);
        if (attMap && attMap.size > 0) {
          const records = [...attMap.values()]
            .filter((e) => e.status !== null)
            .map((e) => ({
              student_profile_id: e.studentProfileId,
              date,
              status: e.status as AttendanceStatus,
              note: null,
            }));
          if (records.length > 0) {
            const res = await bulkRecordAttendance(records);
            if (res.error) {
              toast.error(res.error);
              return;
            }
          }
        }

        // 2. 숙제 저장 (결석자 제외).
        const unitMap = unitEdits.get(classId);
        if (unitMap && unitMap.size > 0) {
          const records = [...unitMap.entries()].map(([key, status]) => {
            const i1 = key.indexOf(":");
            const i2 = key.indexOf(":", i1 + 1);
            return {
              studentId: key.slice(0, i1),
              textbookId: key.slice(i1 + 1, i2),
              unitNumber: Number(key.slice(i2 + 1)),
              status,
            };
          });
          const res = await bulkMarkUnits(records, { excludeAbsentOn: date });
          if (res.error) {
            toast.error(res.error);
            return;
          }
          const parts = [`숙제 ${res.saved}건`];
          if (res.skippedAbsent > 0) parts.push(`결석자 ${res.skippedAbsent}건 제외`);
          toast.success(`저장 완료 · ${parts.join(" · ")}`);
        } else {
          toast.success("출결이 저장되었습니다.");
        }

        // 3. 재조회 (pending 도 loadClass 안에서 초기화).
        await loadClass(classId);
      } finally {
        setSavingClasses((prev) => {
          const next = new Set(prev);
          next.delete(classId);
          return next;
        });
      }
    },
    [attendanceEdits, unitEdits, date, pendingCount, loadClass]
  );

  return {
    // 필터
    group,
    setGroup,
    day,
    setDay,
    periodId,
    setPeriodId,
    date,
    setDate,
    availablePeriods,
    defaultPeriodId,
    filteredClasses,
    initialAbsent,
    // 반 데이터
    cache,
    isLoading: (classId: string) => loadingClasses.has(classId),
    isSaving: (classId: string) => savingClasses.has(classId),
    loadClass,
    // merged 조회
    getMergedAttendance,
    absentStudentIds,
    getMergedUnitStatus,
    dirtyUnitNumbers,
    // mutations
    setAttendance,
    cycleUnit,
    pendingCount,
    cancelClass,
    saveClass,
  };
}

export type TodayClassEditor = ReturnType<typeof useTodayClassEditor>;

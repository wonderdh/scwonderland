"use client";

import {
  addStudentToClass,
  batchUpdateClassStudents,
  createClass,
  deleteClass,
  getClassLinkedCounts,
  listStudentsNotInClass,
  updateClass,
} from "../../actions";
import type { ClassWithDetails, ClassStudentRow, ClassTextbook, Textbook, TeacherOption } from "@/lib/types";
import {
  listClassTextbooks,
  listTextbooks,
} from "../../actions/textbook-actions";
import { batchUpdateClassTextbooks } from "../../actions";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatStudentName } from "@/lib/utils/student-name";
import { ConfirmDialog } from "@/components/overlays/ConfirmDialog";
import { CLASS_COLOR_PALETTE } from "@/lib/constants/class";
import { getAgeColor } from "@/lib/ui/student-age-colors";
import { TeacherBadges } from "@/components/badges/TeacherBadges";
import { GROUP_ORDER } from "@/lib/constants/class";
import { sortStudentsByAgeAndName } from "@/lib/utils/student-sort";

const MANAGE_GROUP_STYLE: Record<string, {
  icon: string;
  sectionBg: string;
  sectionText: string;
  countBg: string;
}> = {
  유치부: { icon: "🌅", sectionBg: "bg-amber-100", sectionText: "text-amber-800", countBg: "bg-amber-200 text-amber-800" },
  오후반: { icon: "☁️", sectionBg: "bg-sky-100", sectionText: "text-sky-800", countBg: "bg-sky-200 text-sky-800" },
  "": { icon: "📋", sectionBg: "bg-slate-100", sectionText: "text-slate-600", countBg: "bg-slate-200 text-slate-600" },
};

type StudentInfo = {
  id: string;
  korean_name: string | null;
  english_name: string | null;
  student_number: string | null;
  age: number | null;
  group_type: string | null;
};

type FlatClassStudent = {
  class_id: string;
  id: string;
  student_profile_id: string;
  korean_name: string | null;
  english_name: string | null;
  student_number: string | null;
};

function UnassignedStudentItem({ s, showAgeBadge }: { s: StudentInfo; showAgeBadge: boolean }) {
  const ageColor = showAgeBadge && s.age !== null ? getAgeColor(s.age) : null;
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData(
          "application/json",
          JSON.stringify({ type: "student", studentProfileId: s.id })
        );
      }}
      className="flex items-center gap-2 text-sm cursor-grab active:cursor-grabbing rounded-lg px-2.5 py-1.5 hover:bg-muted/50 transition-colors"
    >
      <svg className="w-3 h-3 text-muted-foreground/40 shrink-0" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
        <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
      </svg>
      {ageColor && (
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-bold ${ageColor.bg} ${ageColor.text}`}>
          {s.age}세
        </span>
      )}
      <span className="text-foreground text-xs min-w-0 truncate">
        {[s.korean_name, s.english_name].filter(Boolean).join(" / ") || "—"}
      </span>
      {s.student_number && (
        <span className="font-mono text-muted-foreground text-xs shrink-0">
          {s.student_number}
        </span>
      )}
    </div>
  );
}

export function ClassesManager({
  initialClasses,
  teachers,
  allClassStudents,
  allStudents,
}: {
  initialClasses: ClassWithDetails[];
  teachers: TeacherOption[];
  allClassStudents: FlatClassStudent[];
  allStudents: StudentInfo[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editClass, setEditClass] = useState<ClassWithDetails | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClassWithDetails | null>(null);
  const [deleteTargetCounts, setDeleteTargetCounts] = useState<{ studentCount: number; homeworkCount: number; noticeCount: number } | null>(null);
  const [deleteTargetLoading, setDeleteTargetLoading] = useState(false);
  const [addStudentOpen, setAddStudentOpen] = useState<ClassWithDetails | null>(null);
  const [deleteClassPending, setDeleteClassPending] = useState(false);

  // 학생 배정 pending 상태 (저장 전 로컬 변경)
  const [pendingAdds, setPendingAdds] = useState<Map<string, string>>(new Map()); // profileId → classId
  const [pendingRemoves, setPendingRemoves] = useState<Set<string>>(new Set()); // rowId
  const [studentSaving, setStudentSaving] = useState(false);
  const hasPendingStudentChanges = pendingAdds.size > 0 || pendingRemoves.size > 0;

  // 교재 배정 pending 상태
  const [pendingTextbookAdds, setPendingTextbookAdds] = useState<Map<string, Set<string>>>(new Map()); // classId → Set<textbookId>
  const [pendingTextbookRemoves, setPendingTextbookRemoves] = useState<Map<string, Set<string>>>(new Map()); // classId → Set<textbookId>
  const [textbookSaving, setTextbookSaving] = useState(false);
  const hasPendingTextbookChanges = useMemo(() => {
    for (const set of pendingTextbookAdds.values()) if (set.size > 0) return true;
    for (const set of pendingTextbookRemoves.values()) if (set.size > 0) return true;
    return false;
  }, [pendingTextbookAdds, pendingTextbookRemoves]);
  const totalPendingTextbookCount = useMemo(() => {
    let n = 0;
    for (const set of pendingTextbookAdds.values()) n += set.size;
    for (const set of pendingTextbookRemoves.values()) n += set.size;
    return n;
  }, [pendingTextbookAdds, pendingTextbookRemoves]);

  // 오른쪽 패널 모드
  const [rightMode, setRightMode] = useState<"students" | "textbooks">("students");
  const [rightSearch, setRightSearch] = useState("");
  const [rightGroupFilter, setRightGroupFilter] = useState<"all" | "유치부" | "오후반">("all");

  // 오른쪽 패널: 전체 교재 목록
  const [allTextbooks, setAllTextbooks] = useState<Textbook[]>([]);
  const [allTextbooksLoaded, setAllTextbooksLoaded] = useState(false);

  // 왼쪽 카드: per-class textbooks
  const [cardTextbooks, setCardTextbooks] = useState<Record<string, ClassTextbook[]>>({});
  const [cardTextbooksLoaded, setCardTextbooksLoaded] = useState<Record<string, boolean>>({});

  // 교재 pending을 반영한 실효 카드 교재 목록
  const effectiveCardTextbooks = useMemo(() => {
    const result: Record<string, ClassTextbook[]> = {};
    for (const c of initialClasses) {
      const base = (cardTextbooks[c.id] ?? []).filter(
        (ct) => !(pendingTextbookRemoves.get(c.id)?.has(ct.textbook_id))
      );
      const adds: ClassTextbook[] = [];
      for (const textbookId of (pendingTextbookAdds.get(c.id) ?? new Set())) {
        const tb = allTextbooks.find((t) => t.id === textbookId);
        if (tb) {
          adds.push({
            id: `pending-${textbookId}`,
            class_id: c.id,
            textbook_id: textbookId,
            textbook_title: tb.title,
            textbook_series: tb.series ?? null,
            textbook_level: tb.level ?? null,
            textbook_category: tb.category,
            total_units: tb.total_units,
            assigned_at: new Date().toISOString(),
          });
        }
      }
      result[c.id] = [...base, ...adds];
    }
    return result;
  }, [cardTextbooks, pendingTextbookAdds, pendingTextbookRemoves, allTextbooks, initialClasses]);

  // 드래그 앤 드롭: 호버 중인 카드
  const [dropTargetClassId, setDropTargetClassId] = useState<string | null>(null);

  // 알림 토스트
  const [notification, setNotification] = useState<{ type: "error" | "success"; message: string } | null>(null);

  // pending 변경을 반영한 실효 학생 배정 목록
  const effectiveClassStudents = useMemo(() => {
    const base = allClassStudents.filter((cs) => !pendingRemoves.has(cs.id));
    const adds: FlatClassStudent[] = [];
    for (const [profileId, classId] of pendingAdds) {
      const s = allStudents.find((st) => st.id === profileId);
      if (s) {
        adds.push({
          class_id: classId,
          id: `pending-${profileId}`,
          student_profile_id: profileId,
          korean_name: s.korean_name,
          english_name: s.english_name,
          student_number: s.student_number,
        });
      }
    }
    return [...base, ...adds];
  }, [allClassStudents, pendingRemoves, pendingAdds, allStudents]);

  const studentsByClassId = useMemo(() => {
    const map: Record<string, ClassStudentRow[]> = {};
    for (const s of effectiveClassStudents) {
      if (!map[s.class_id]) map[s.class_id] = [];
      map[s.class_id].push({
        id: s.id,
        student_profile_id: s.student_profile_id,
        korean_name: s.korean_name,
        english_name: s.english_name,
        student_number: s.student_number,
      });
    }
    return map;
  }, [effectiveClassStudents]);

  // 학생의 소속 반 정보
  const studentClassMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const cs of effectiveClassStudents) {
      if (!map[cs.student_profile_id]) map[cs.student_profile_id] = [];
      const cls = initialClasses.find((c) => c.id === cs.class_id);
      if (cls) map[cs.student_profile_id].push(cls.name);
    }
    return map;
  }, [effectiveClassStudents, initialClasses]);

  // 왼쪽 패널 검색 필터 (방과후 제외)
  const filteredClasses = useMemo(() => {
    const nonAfterschool = initialClasses.filter((c) => c.group_label !== "방과후");
    let result =
      groupFilter === "all"
        ? nonAfterschool
        : nonAfterschool.filter((c) => (c.group_label ?? "") === groupFilter);
    if (activeOnly) result = result.filter((c) => c.schedule_count > 0);
    if (teacherFilter) result = result.filter((c) => c.teachers.some((t) => t.profile_id === teacherFilter));
    if (!search.trim()) return result;
    const q = search.trim().toLowerCase();
    return result.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.group_label && c.group_label.toLowerCase().includes(q)) return true;
      const students = studentsByClassId[c.id] ?? [];
      return students.some(
        (s) =>
          (s.korean_name && s.korean_name.toLowerCase().includes(q)) ||
          (s.english_name && s.english_name.toLowerCase().includes(q)) ||
          (s.student_number && s.student_number.toLowerCase().includes(q))
      );
    });
  }, [initialClasses, search, groupFilter, teacherFilter, activeOnly, studentsByClassId]);

  const groupedFilteredClasses = useMemo(() => {
    const map = new Map<string, ClassWithDetails[]>([
      ["유치부", []],
      ["오후반", []],
      ["", []],
    ]);
    for (const c of filteredClasses) {
      const key = c.group_label ?? "";
      map.get(key)!.push(c);
    }
    return map;
  }, [filteredClasses]);

  // 오른쪽 패널: 미배정 학생만 + 검색/그룹 필터 (나이순 → 이름순)
  const filteredRightStudents = useMemo(() => {
    let unassigned = allStudents.filter(
      (s) => !studentClassMap[s.id] || studentClassMap[s.id].length === 0
    );
    // 그룹 필터
    if (rightGroupFilter === "유치부") {
      unassigned = unassigned.filter((s) => s.group_type === "유치부");
    } else if (rightGroupFilter === "오후반") {
      unassigned = unassigned.filter((s) => s.group_type === "오후반");
    }
    // 검색 필터
    if (rightSearch.trim()) {
      const q = rightSearch.trim().toLowerCase();
      unassigned = unassigned.filter(
        (s) =>
          (s.korean_name && s.korean_name.toLowerCase().includes(q)) ||
          (s.english_name && s.english_name.toLowerCase().includes(q)) ||
          (s.student_number && s.student_number.toLowerCase().includes(q))
      );
    }
    // 나이순 → 이름순
    return sortStudentsByAgeAndName(unassigned);
  }, [allStudents, studentClassMap, rightSearch, rightGroupFilter]);

  // 오른쪽 패널: 교재 검색 필터
  const filteredRightTextbooks = useMemo(() => {
    if (!rightSearch.trim()) return allTextbooks;
    const q = rightSearch.trim().toLowerCase();
    return allTextbooks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.series && t.series.toLowerCase().includes(q)) ||
        (t.level && `lv.${t.level}`.includes(q))
    );
  }, [allTextbooks, rightSearch]);

  // 교재 목록 로드
  const loadAllTextbooks = useCallback(async () => {
    const data = await listTextbooks();
    setAllTextbooks(data);
    setAllTextbooksLoaded(true);
  }, []);

  useEffect(() => {
    if (rightMode === "textbooks" && !allTextbooksLoaded) {
      loadAllTextbooks();
    }
  }, [rightMode, allTextbooksLoaded, loadAllTextbooks]);

  // 왼쪽 카드: per-class 교재 로드
  const loadCardTextbooks = useCallback(async (classId: string) => {
    const data = await listClassTextbooks(classId);
    setCardTextbooks((prev) => ({ ...prev, [classId]: data }));
    setCardTextbooksLoaded((prev) => ({ ...prev, [classId]: true }));
  }, []);

  useEffect(() => {
    if (rightMode === "textbooks") {
      for (const c of initialClasses) {
        if (!cardTextbooksLoaded[c.id]) {
          loadCardTextbooks(c.id);
        }
      }
    }
  }, [rightMode, initialClasses, cardTextbooksLoaded, loadCardTextbooks]);

  // 알림 자동 해제
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // 교재 제거: 로컬 pending 상태로 변경 (즉시 저장 없음)
  const handleRemoveTextbookFromCard = (classId: string, textbookId: string) => {
    const isPendingAdd = pendingTextbookAdds.get(classId)?.has(textbookId);
    if (isPendingAdd) {
      setPendingTextbookAdds((prev) => {
        const next = new Map(prev);
        const classAdds = new Set(next.get(classId) ?? []);
        classAdds.delete(textbookId);
        if (classAdds.size === 0) next.delete(classId);
        else next.set(classId, classAdds);
        return next;
      });
    } else {
      setPendingTextbookRemoves((prev) => {
        const next = new Map(prev);
        const classRemoves = new Set(next.get(classId) ?? []);
        classRemoves.add(textbookId);
        next.set(classId, classRemoves);
        return next;
      });
    }
  };

  // 드롭 핸들러: 학생을 카드에 드롭 (로컬 pending 상태로 변경)
  const handleDropStudentToCard = (classId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDropTargetClassId(null);

    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return; }
    if (parsed.type !== "student") return;

    const { studentProfileId } = parsed;

    // 이미 이 반에 있는지 확인 (실효 상태 기준)
    const existing = studentsByClassId[classId] ?? [];
    if (existing.some((s) => s.student_profile_id === studentProfileId)) {
      setNotification({ type: "error", message: "이미 이 반에 소속된 학생입니다." });
      return;
    }

    // 다른 반에 배정돼 있으면 해당 반에서도 제거 예약
    const currentEntry = effectiveClassStudents.find(
      (cs) => cs.student_profile_id === studentProfileId
    );
    if (currentEntry) {
      if (currentEntry.id.startsWith("pending-")) {
        // pending add만 교체
        setPendingAdds((prev) => new Map([...prev, [studentProfileId, classId]]));
      } else {
        // DB 행 제거 예약 + 새 반 추가 예약
        setPendingRemoves((prev) => new Set([...prev, currentEntry.id]));
        setPendingAdds((prev) => new Map([...prev, [studentProfileId, classId]]));
      }
    } else {
      setPendingAdds((prev) => new Map([...prev, [studentProfileId, classId]]));
    }

    const studentName = allStudents.find((s) => s.id === studentProfileId);
    const name = studentName ? formatStudentName(studentName, { fallback: "학생" }) : "학생";
    const targetClassName = initialClasses.find((c) => c.id === classId)?.name ?? "";
    setNotification({ type: "success", message: `${name} → ${targetClassName} (미저장)` });
  };

  // 학생 제외: 로컬 pending 상태로 변경 (즉시 저장 없음)
  const handleRemoveStudentPending = (row: ClassStudentRow) => {
    if (row.id.startsWith("pending-")) {
      // pending add 취소
      setPendingAdds((prev) => {
        const next = new Map(prev);
        next.delete(row.student_profile_id);
        return next;
      });
    } else {
      // DB 행 제거 예약
      setPendingRemoves((prev) => new Set([...prev, row.id]));
    }
  };

  // 저장 버튼: pending 변경 일괄 적용 (단일 server action 호출)
  const handleSaveStudentChanges = async () => {
    setStudentSaving(true);
    try {
      const removes = [...pendingRemoves];
      const adds = [...pendingAdds].map(([profileId, classId]) => ({ classId, profileId }));
      const result = await batchUpdateClassStudents(removes, adds);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      setPendingAdds(new Map());
      setPendingRemoves(new Set());
      toast.success("저장되었습니다.");
      router.refresh();
    } catch {
      toast.error("저장 중 오류가 발생했습니다.");
    } finally {
      setStudentSaving(false);
    }
  };

  const handleCancelStudentChanges = () => {
    setPendingAdds(new Map());
    setPendingRemoves(new Set());
  };

  // 드롭 핸들러: 교재를 카드에 드롭 (로컬 pending 상태로 변경)
  const handleDropTextbookToCard = (classId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDropTargetClassId(null);

    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return; }
    if (parsed.type !== "textbook") return;

    const { textbookId } = parsed;

    // 이미 배정되어 있는지 확인 (실효 상태 기준)
    const existing = effectiveCardTextbooks[classId] ?? [];
    if (existing.some((ct) => ct.textbook_id === textbookId)) {
      setNotification({ type: "error", message: "이미 이 반에 배정된 교재입니다." });
      return;
    }

    // pending remove에 있으면 취소 (재추가)
    if (pendingTextbookRemoves.get(classId)?.has(textbookId)) {
      setPendingTextbookRemoves((prev) => {
        const next = new Map(prev);
        const classRemoves = new Set(next.get(classId) ?? []);
        classRemoves.delete(textbookId);
        if (classRemoves.size === 0) next.delete(classId);
        else next.set(classId, classRemoves);
        return next;
      });
      return;
    }

    setPendingTextbookAdds((prev) => {
      const next = new Map(prev);
      const classAdds = new Set(next.get(classId) ?? []);
      classAdds.add(textbookId);
      next.set(classId, classAdds);
      return next;
    });

    const tbName = allTextbooks.find((t) => t.id === textbookId)?.title ?? "교재";
    const className = initialClasses.find((c) => c.id === classId)?.name ?? "";
    setNotification({ type: "success", message: `${tbName} → ${className} (미저장)` });
  };

  // 저장: 교재 pending 변경 일괄 적용 (단일 server action 호출)
  const handleSaveTextbookChanges = async () => {
    setTextbookSaving(true);
    try {
      const removes: { classId: string; textbookId: string }[] = [];
      for (const [classId, textbookIds] of pendingTextbookRemoves) {
        for (const textbookId of textbookIds) removes.push({ classId, textbookId });
      }
      const adds: { classId: string; textbookId: string }[] = [];
      for (const [classId, textbookIds] of pendingTextbookAdds) {
        for (const textbookId of textbookIds) adds.push({ classId, textbookId });
      }
      const result = await batchUpdateClassTextbooks(removes, adds);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      const affectedClassIds = new Set([
        ...pendingTextbookAdds.keys(),
        ...pendingTextbookRemoves.keys(),
      ]);
      await Promise.all([...affectedClassIds].map((classId) => loadCardTextbooks(classId)));
      setPendingTextbookAdds(new Map());
      setPendingTextbookRemoves(new Map());
      toast.success("저장되었습니다.");
      router.refresh();
    } catch {
      toast.error("저장 중 오류가 발생했습니다.");
    } finally {
      setTextbookSaving(false);
    }
  };

  const handleCancelTextbookChanges = () => {
    setPendingTextbookAdds(new Map());
    setPendingTextbookRemoves(new Map());
  };

  return (
    <div className="space-y-4">
      {/* 알림 토스트 */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 shadow-lg text-sm font-medium transition-all ${
            notification.type === "error"
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "error" ? (
              <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            ) : (
              <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            )}
            {notification.message}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">반 목록</h2>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center h-11 rounded-lg bg-emerald-600 px-4 text-base font-medium text-white hover:bg-emerald-500 shadow-sm"
        >
          + 반 추가
        </button>
      </div>

      {/* 좌우 분할 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* ===== 왼쪽 패널: 반 카드 목록 ===== */}
        <div className="space-y-3">
          <div className="rounded-xl border bg-card p-3">
            <div className="flex items-center gap-2 mb-2">
              <svg className="size-4 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="search"
                placeholder="반 이름 · 학생 이름 · 학번 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-0 rounded-lg border border-input px-3 py-1.5 text-sm text-foreground placeholder-muted-foreground bg-background"
              />
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="rounded-lg border border-input px-2.5 py-1.5 text-sm text-foreground bg-background shrink-0"
              >
                <option value="all">전체</option>
                <option value="유치부">🌅 유치부</option>
                <option value="오후반">☁️ 오후반</option>
                <option value="">미지정</option>
              </select>
              <select
                value={teacherFilter}
                onChange={(e) => setTeacherFilter(e.target.value)}
                className="rounded-lg border border-input px-2.5 py-1.5 text-sm text-foreground bg-background shrink-0"
              >
                <option value="">선생님 전체</option>
                {teachers.filter((t) => t.teacher_type === "native").length > 0 && (
                  <optgroup label="원어민">
                    {teachers.filter((t) => t.teacher_type === "native").map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </optgroup>
                )}
                {teachers.filter((t) => t.teacher_type === "korean").length > 0 && (
                  <optgroup label="한국인">
                    {teachers.filter((t) => t.teacher_type === "korean").map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <button
                type="button"
                onClick={() => setActiveOnly((v) => !v)}
                className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-sm transition-colors ${
                  activeOnly
                    ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                    : "border-input bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                활성 수업만
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {rightMode === "students"
                ? "오른쪽에서 학생을 드래그하여 반에 추가하세요"
                : "오른쪽에서 교재를 드래그하여 반에 배정하세요"}
            </p>
          </div>

          <div className="space-y-2 max-h-[calc(100vh-240px)] overflow-y-auto pr-1">
            {filteredClasses.length === 0 ? (
              <div className="rounded-xl border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                {search.trim() || groupFilter !== "all" || teacherFilter || activeOnly ? "검색 결과가 없습니다." : "등록된 반이 없습니다. 반 추가로 생성하세요."}
              </div>
            ) : (
              GROUP_ORDER.map((group) => {
                const groupClasses = groupedFilteredClasses.get(group) ?? [];
                if (groupClasses.length === 0) return null;
                const style = MANAGE_GROUP_STYLE[group];
                const label = group || "미지정";
                return (
                  <div key={group} className="space-y-2">
                    <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${style.sectionBg}`}>
                      <span className="text-sm leading-none">{style.icon}</span>
                      <span className={`text-xs font-semibold ${style.sectionText}`}>{label}</span>
                      <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${style.countBg}`}>
                        {groupClasses.length}개
                      </span>
                    </div>
                    <div className="space-y-3 pl-1">
                      {groupClasses.map((c) => (
                        <ClassCard
                          key={c.id}
                          classRow={c}
                          students={studentsByClassId[c.id] ?? []}
                          globalMode={rightMode}
                          textbooks={effectiveCardTextbooks[c.id] ?? []}
                          textbooksLoaded={cardTextbooksLoaded[c.id] ?? false}
                          onEdit={() => setEditClass(c)}
                          onDelete={async () => {
                            setDeleteTarget(c);
                            setDeleteTargetCounts(null);
                            setDeleteTargetLoading(true);
                            const counts = await getClassLinkedCounts(c.id);
                            setDeleteTargetLoading(false);
                            setDeleteTargetCounts(counts);
                          }}
                          onRemoveStudent={(row) => handleRemoveStudentPending(row)}
                          onRemoveTextbook={(textbookId) =>
                            handleRemoveTextbookFromCard(c.id, textbookId)
                          }
                          isDropTarget={dropTargetClassId === c.id}
                          onDragOver={() => setDropTargetClassId(c.id)}
                          onDragLeave={() => setDropTargetClassId(null)}
                          onDrop={(e) =>
                            rightMode === "students"
                              ? handleDropStudentToCard(c.id, e)
                              : handleDropTextbookToCard(c.id, e)
                          }
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ===== 오른쪽 패널: 학생/교재 소스 목록 ===== */}
        <div className="lg:sticky lg:top-6 self-start space-y-3">
          <div className="rounded-xl border-2 border-primary/30 bg-card overflow-hidden shadow-sm">
            {/* 모드 토글 헤더 */}
            <div className="flex border-b">
              <button
                type="button"
                onClick={() => { setRightMode("students"); setRightSearch(""); }}
                className={`flex-1 px-4 py-2.5 text-sm font-semibold transition-colors ${
                  rightMode === "students"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                    : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                  </svg>
                  학생 관리
                </span>
              </button>
              <button
                type="button"
                onClick={() => { setRightMode("textbooks"); setRightSearch(""); }}
                className={`flex-1 px-4 py-2.5 text-sm font-semibold transition-colors ${
                  rightMode === "textbooks"
                    ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white"
                    : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                  </svg>
                  교재 관리
                </span>
              </button>
            </div>

            <div className="p-4 space-y-3">
              {rightMode === "students" ? (
                <>
                  {/* ===== 학생 목록 ===== */}
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">미배정 학생</h3>
                    <span className="text-xs text-muted-foreground">{filteredRightStudents.length}명</span>
                  </div>

                  {/* 그룹 필터 */}
                  <div className="flex gap-1">
                    {(["all", "유치부", "오후반"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setRightGroupFilter(f)}
                        className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                          rightGroupFilter === f
                            ? "bg-slate-700 text-white"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {f === "all" ? "전체" : f === "유치부" ? "🌅 유치부" : "☁️ 오후반"}
                      </button>
                    ))}
                  </div>

                  {hasPendingStudentChanges && (
                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                      <span className="text-xs text-amber-700 flex-1">
                        변경 {pendingAdds.size + pendingRemoves.size}건 미저장
                      </span>
                      <button
                        type="button"
                        onClick={handleSaveStudentChanges}
                        disabled={studentSaving}
                        className="rounded px-2.5 py-1 text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {studentSaving ? "저장 중…" : "저장"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelStudentChanges}
                        disabled={studentSaving}
                        className="rounded px-2.5 py-1 text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        취소
                      </button>
                    </div>
                  )}
                  <input
                    type="search"
                    placeholder="이름 · 학번 검색"
                    value={rightSearch}
                    onChange={(e) => setRightSearch(e.target.value)}
                    className="w-full rounded-lg border border-input px-3 py-1.5 text-sm text-foreground placeholder-muted-foreground bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    학생을 드래그하여 왼쪽 반에 추가하세요
                  </p>

                  <div className="max-h-[calc(100vh-360px)] overflow-y-auto rounded-xl border border-muted p-1.5">
                    {filteredRightStudents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <svg className="size-8 text-muted-foreground/30 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                        </svg>
                        <p className="text-sm text-muted-foreground">
                          {rightSearch.trim() ? "검색 결과가 없습니다." : "등록된 학생이 없습니다."}
                        </p>
                      </div>
                    ) : rightGroupFilter === "오후반" ? (
                      /* 오후반 필터: age > 7만, 색상 없이 평면 목록 */
                      <div className="space-y-0.5">
                        {filteredRightStudents.map((s) => (
                          <UnassignedStudentItem key={s.id} s={s} showAgeBadge={false} />
                        ))}
                      </div>
                    ) : (
                      /* 전체 or 유치부: 나이별 섹션 */
                      (() => {
                        const yuchibuStudents = filteredRightStudents.filter((s) => s.group_type === "유치부");
                        const ohubanStudents = filteredRightStudents.filter((s) => s.group_type === "오후반");
                        const etcStudents = filteredRightStudents.filter((s) => s.group_type !== "유치부" && s.group_type !== "오후반");
                        return (
                          <div className="space-y-2">
                            {/* 유치부 섹션 */}
                            {yuchibuStudents.length > 0 && (
                              <div>
                                {rightGroupFilter === "all" && (
                                  <div className="flex items-center gap-1.5 px-2 py-1 mb-1">
                                    <span className="text-xs font-semibold text-amber-700">🌅 유치부</span>
                                    <span className="text-xs text-amber-600">({yuchibuStudents.length}명)</span>
                                  </div>
                                )}
                                <div className="space-y-0.5">
                                  {yuchibuStudents.map((s) => (
                                    <UnassignedStudentItem key={s.id} s={s} showAgeBadge={false} />
                                  ))}
                                </div>
                              </div>
                            )}
                            {/* 오후반 섹션 (전체 필터일 때만) */}
                            {rightGroupFilter === "all" && ohubanStudents.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1.5 px-2 py-1 mb-1">
                                  <span className="text-xs font-semibold text-sky-700">☁️ 오후반</span>
                                  <span className="text-xs text-sky-600">({ohubanStudents.length}명)</span>
                                </div>
                                <div className="space-y-0.5">
                                  {ohubanStudents.map((s) => (
                                    <UnassignedStudentItem key={s.id} s={s} showAgeBadge={false} />
                                  ))}
                                </div>
                              </div>
                            )}
                            {/* 나이 미설정 학생 (전체 필터일 때만) */}
                            {rightGroupFilter === "all" && etcStudents.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1.5 px-2 py-1 mb-1">
                                  <span className="text-xs font-semibold text-slate-500">📋 미분류</span>
                                  <span className="text-xs text-slate-400">({etcStudents.length}명)</span>
                                </div>
                                <div className="space-y-0.5">
                                  {etcStudents.map((s) => (
                                    <UnassignedStudentItem key={s.id} s={s} showAgeBadge={false} />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* ===== 교재 목록 ===== */}
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">전체 교재</h3>
                    <span className="text-xs text-muted-foreground">
                      {allTextbooksLoaded ? `${allTextbooks.length}권` : "…"}
                    </span>
                  </div>
                  {hasPendingTextbookChanges && (
                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                      <span className="text-xs text-amber-700 flex-1">
                        변경 {totalPendingTextbookCount}건 미저장
                      </span>
                      <button
                        type="button"
                        onClick={handleSaveTextbookChanges}
                        disabled={textbookSaving}
                        className="rounded px-2.5 py-1 text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
                      >
                        {textbookSaving ? "저장 중…" : "저장"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelTextbookChanges}
                        disabled={textbookSaving}
                        className="rounded px-2.5 py-1 text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        취소
                      </button>
                    </div>
                  )}
                  <input
                    type="search"
                    placeholder="교재명 · 시리즈 · 레벨 검색"
                    value={rightSearch}
                    onChange={(e) => setRightSearch(e.target.value)}
                    className="w-full rounded-lg border border-input px-3 py-1.5 text-sm text-foreground placeholder-muted-foreground bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    교재를 드래그하여 왼쪽 반에 배정하세요
                  </p>

                  <div className="max-h-[calc(100vh-360px)] overflow-y-auto space-y-0.5 rounded-xl border border-muted p-1.5">
                    {!allTextbooksLoaded ? (
                      <div className="flex items-center justify-center py-8">
                        <p className="text-sm text-muted-foreground">불러오는 중…</p>
                      </div>
                    ) : filteredRightTextbooks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <svg className="size-8 text-muted-foreground/30 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                        </svg>
                        <p className="text-sm text-muted-foreground">
                          {rightSearch.trim() ? "검색 결과가 없습니다." : "등록된 교재가 없습니다."}
                        </p>
                      </div>
                    ) : (
                      filteredRightTextbooks.map((t) => (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData(
                              "application/json",
                              JSON.stringify({ type: "textbook", textbookId: t.id })
                            );
                          }}
                          className="flex items-center gap-2 text-sm cursor-grab active:cursor-grabbing rounded-lg px-2.5 py-1.5 hover:bg-muted/50 transition-colors"
                        >
                          <svg className="w-3 h-3 text-muted-foreground/40 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
                            <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                            <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
                          </svg>
                          <span className="text-foreground text-xs min-w-0 truncate">{t.title}</span>
                          <div className="flex items-center gap-1.5 ml-auto shrink-0">
                            {t.series && (
                              <span className="text-xs text-muted-foreground">{t.series}</span>
                            )}
                            {t.level && (
                              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                                Lv.{t.level}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground/70">
                              {t.total_units}단원
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 모달들 */}
      {createOpen && (
        <AddClassModal
          teachers={teachers}
          onClose={() => setCreateOpen(false)}
          onSuccess={() => {
            setCreateOpen(false);
            toast.success("반이 생성되었습니다.");
            router.refresh();
          }}
        />
      )}
      {editClass && (
        <EditClassModal
          classRow={editClass}
          teachers={teachers}
          onClose={() => setEditClass(null)}
          onSuccess={() => {
            setEditClass(null);
            toast.success("반이 수정되었습니다.");
            router.refresh();
          }}
        />
      )}
      {addStudentOpen && (
        <AddStudentModal
          classId={addStudentOpen.id}
          onClose={() => setAddStudentOpen(null)}
          onSuccess={() => {
            setAddStudentOpen(null);
            router.refresh();
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        danger
        title={deleteTarget ? `"${deleteTarget.name}" 반을 삭제하시겠습니까?` : "반을 삭제하시겠습니까?"}
        description={deleteTargetLoading ? "연관 데이터를 확인하는 중입니다…" : "삭제된 반은 복구할 수 없습니다."}
        impactList={(() => {
          const items: string[] = [];
          if (deleteTargetCounts) {
            if (deleteTargetCounts.studentCount > 0) items.push(`${deleteTargetCounts.studentCount}명의 학생 등록이 해제됩니다`);
            if (deleteTargetCounts.homeworkCount > 0) items.push(`숙제 ${deleteTargetCounts.homeworkCount}건이 함께 삭제됩니다`);
            if (deleteTargetCounts.noticeCount > 0) items.push(`공지 ${deleteTargetCounts.noticeCount}건이 함께 삭제됩니다`);
          }
          if (items.length === 0) items.push("연관 데이터가 없습니다.");
          return items;
        })()}
        confirmLabel="삭제"
        disabled={deleteClassPending || deleteTargetLoading}
        onCancel={() => { setDeleteTarget(null); setDeleteTargetCounts(null); }}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setDeleteClassPending(true);
          await deleteClass(deleteTarget.id);
          setDeleteClassPending(false);
          setDeleteTarget(null);
          setDeleteTargetCounts(null);
          toast.success("반이 삭제되었습니다.");
          router.refresh();
        }}
      />
    </div>
  );
}

/* ===== 왼쪽 반 카드 ===== */
function ClassCard({
  classRow,
  students,
  globalMode,
  textbooks,
  textbooksLoaded,
  onEdit,
  onDelete,
  onRemoveStudent,
  onRemoveTextbook,
  isDropTarget,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  classRow: ClassWithDetails;
  students: ClassStudentRow[];
  globalMode: "students" | "textbooks";
  textbooks: ClassTextbook[];
  textbooksLoaded: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onRemoveStudent: (row: ClassStudentRow) => void;
  onRemoveTextbook: (textbookId: string) => void;
  isDropTarget: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div
      className={`rounded-xl border-2 bg-card overflow-hidden transition-all ${
        isDropTarget
          ? globalMode === "students"
            ? "border-emerald-400 bg-emerald-50/30 shadow-md"
            : "border-blue-400 bg-blue-50/30 shadow-md"
          : "border-border"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver();
      }}
      onDragLeave={() => onDragLeave()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(e);
      }}
    >
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-foreground">{classRow.name}</span>
          <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-base font-medium text-violet-700">
            {classRow.student_count}명
          </span>
          {isDropTarget && (
            <span className={`text-sm font-medium animate-pulse ${
              globalMode === "students" ? "text-emerald-600" : "text-blue-600"
            }`}>
              여기에 놓기
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-base text-muted-foreground mr-1">
            담당: <TeacherBadges teachers={classRow.teachers} />
          </span>
          <button
            type="button"
            onClick={onEdit}
            className="h-11 inline-flex items-center rounded-lg bg-secondary px-3 text-base font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            수정
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="h-11 inline-flex items-center rounded-lg bg-destructive/10 px-3 text-base font-medium text-destructive hover:bg-destructive/20"
          >
            삭제
          </button>
        </div>
      </div>

      {/* 콘텐츠 - globalMode에 따라 학생 또는 교재 표시 */}
      <div className="px-4 py-2.5">
        {globalMode === "students" ? (
          students.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">
              {isDropTarget ? "여기에 학생을 놓으세요" : "소속 학생 없음"}
            </p>
          ) : (
            <ul className="space-y-1">
              {students.map((s) => {
                const isPending = s.id.startsWith("pending-");
                return (
                  <li
                    key={s.id}
                    className={`flex items-center justify-between gap-2 text-sm rounded-lg px-2 py-1 transition-colors ${
                      isPending ? "bg-amber-50 border border-amber-200" : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="text-foreground text-xs">
                      {[s.korean_name, s.english_name].filter(Boolean).join(" / ") || "—"}
                      {s.student_number && (
                        <span className="ml-1.5 font-mono text-muted-foreground text-xs">
                          {s.student_number}
                        </span>
                      )}
                      {isPending && (
                        <span className="ml-1.5 text-xs text-amber-600">미저장</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveStudent(s)}
                      className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive hover:bg-destructive/20"
                    >
                      제외
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : !textbooksLoaded ? (
          <p className="text-xs text-muted-foreground py-2 text-center">불러오는 중…</p>
        ) : textbooks.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 text-center">
            {isDropTarget ? "여기에 교재를 놓으세요" : "배정된 교재 없음"}
          </p>
        ) : (
          <ul className="space-y-1">
            {textbooks.map((ct) => {
              const isPending = ct.id.startsWith("pending-");
              return (
                <li
                  key={ct.id}
                  className={`flex items-center justify-between gap-2 text-sm rounded-lg px-2 py-1 transition-colors ${
                    isPending ? "bg-amber-50 border border-amber-200" : "hover:bg-muted/50"
                  }`}
                >
                  <span className="text-foreground text-xs">
                    {ct.textbook_title}
                    {ct.textbook_level && (
                      <span className="ml-1.5 text-muted-foreground">
                        Lv.{ct.textbook_level}
                      </span>
                    )}
                    <span className="ml-1.5 text-muted-foreground/70">
                      {ct.total_units}단원
                    </span>
                    {isPending && (
                      <span className="ml-1.5 text-xs text-amber-600">미저장</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveTextbook(ct.textbook_id)}
                    className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive hover:bg-destructive/20"
                  >
                    제거
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ===== 모달 컴포넌트들 ===== */

function AddClassModal({
  teachers,
  onClose,
  onSuccess,
}: {
  teachers: TeacherOption[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [groupLabel, setGroupLabel] = useState("");
  const [colorIndex, setColorIndex] = useState<number | null>(null);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTeacher = (id: string) => {
    setSelectedTeacherIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : prev.length < 2 ? [...prev, id] : prev
    );
  };

  const filteredTeachers = useMemo(() => {
    if (!teacherSearch.trim()) return teachers;
    const q = teacherSearch.trim().toLowerCase();
    return teachers.filter((t) => t.name.toLowerCase().includes(q));
  }, [teachers, teacherSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await createClass(name.trim(), selectedTeacherIds, groupLabel, colorIndex);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onSuccess();
  };

  return (
    <Modal title="반 추가" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              반 이름
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-input px-3 py-2 text-foreground bg-background"
              placeholder="예: 토요 1반"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              그룹
            </label>
            <select
              value={groupLabel}
              onChange={(e) => setGroupLabel(e.target.value)}
              className="w-full rounded-lg border border-input px-3 py-2 text-foreground bg-background"
            >
              <option value="">미지정</option>
              <option value="유치부">유치부</option>
              <option value="오후반">오후반</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            색상 <span className="text-muted-foreground font-normal">(시간표 표시색)</span>
          </label>
          <div className="flex flex-wrap gap-2 items-center">
            {CLASS_COLOR_PALETTE.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setColorIndex(i)}
                className={`w-6 h-6 rounded-full ${c.bg} border-2 ${colorIndex === i ? "border-slate-600 scale-110" : "border-transparent"} transition-all`}
                title={`색상 ${i + 1}`}
              />
            ))}
            <button
              type="button"
              onClick={() => setColorIndex(null)}
              className={`w-6 h-6 rounded-full bg-slate-100 border-2 ${colorIndex === null ? "border-slate-600 scale-110" : "border-transparent"} transition-all`}
              title="자동"
            />
            <span className="text-xs text-muted-foreground ml-1">
              {colorIndex === null ? "자동 배정" : `색상 ${colorIndex + 1}`}
            </span>
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            담당 선생님 <span className="text-muted-foreground font-normal">(최대 2명)</span>
          </label>
          <input
            type="search"
            placeholder="선생님 이름 검색"
            value={teacherSearch}
            onChange={(e) => setTeacherSearch(e.target.value)}
            className="w-full rounded-lg border border-input px-3 py-1.5 text-sm text-foreground placeholder-muted-foreground bg-background mb-2"
          />
          <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-lg border border-input p-2">
            {filteredTeachers.map((t) => (
              <label
                key={t.id}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${
                  selectedTeacherIds.includes(t.id) ? "bg-primary/10" : "hover:bg-muted/50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedTeacherIds.includes(t.id)}
                  onChange={() => toggleTeacher(t.id)}
                  disabled={!selectedTeacherIds.includes(t.id) && selectedTeacherIds.length >= 2}
                  className="rounded"
                />
                <span className="text-sm text-foreground">{t.name}</span>
                <span className={`ml-auto rounded px-1.5 py-0.5 text-xs font-medium ${
                  t.teacher_type === "native" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                }`}>
                  {t.teacher_type === "native" ? "원어민" : "한국인"}
                </span>
              </label>
            ))}
            {teachers.length === 0 && (
              <p className="text-xs text-muted-foreground py-2 text-center">등록된 교사가 없습니다.</p>
            )}
            {teachers.length > 0 && filteredTeachers.length === 0 && (
              <p className="text-xs text-muted-foreground py-2 text-center">검색 결과 없음</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {pending ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditClassModal({
  classRow,
  teachers,
  onClose,
  onSuccess,
}: {
  classRow: ClassWithDetails;
  teachers: TeacherOption[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(classRow.name);
  const [groupLabel, setGroupLabel] = useState(classRow.group_label ?? "");
  const [colorIndex, setColorIndex] = useState<number | null>(classRow.color_index ?? null);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>(
    classRow.teachers.map((t) => t.profile_id)
  );
  const [teacherSearch, setTeacherSearch] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTeacher = (id: string) => {
    setSelectedTeacherIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : prev.length < 2 ? [...prev, id] : prev
    );
  };

  const filteredTeachers = useMemo(() => {
    if (!teacherSearch.trim()) return teachers;
    const q = teacherSearch.trim().toLowerCase();
    return teachers.filter((t) => t.name.toLowerCase().includes(q));
  }, [teachers, teacherSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await updateClass(
      classRow.id,
      name.trim(),
      selectedTeacherIds,
      groupLabel,
      colorIndex,
    );
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onSuccess();
  };

  return (
    <Modal title="반 수정" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              반 이름
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-input px-3 py-2 text-foreground bg-background"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              그룹
            </label>
            <select
              value={groupLabel}
              onChange={(e) => setGroupLabel(e.target.value)}
              className="w-full rounded-lg border border-input px-3 py-2 text-foreground bg-background"
            >
              <option value="">미지정</option>
              <option value="유치부">유치부</option>
              <option value="오후반">오후반</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            색상 <span className="text-muted-foreground font-normal">(시간표 표시색)</span>
          </label>
          <div className="flex flex-wrap gap-2 items-center">
            {CLASS_COLOR_PALETTE.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setColorIndex(i)}
                className={`w-6 h-6 rounded-full ${c.bg} border-2 ${colorIndex === i ? "border-slate-600 scale-110" : "border-transparent"} transition-all`}
                title={`색상 ${i + 1}`}
              />
            ))}
            <button
              type="button"
              onClick={() => setColorIndex(null)}
              className={`w-6 h-6 rounded-full bg-slate-100 border-2 ${colorIndex === null ? "border-slate-600 scale-110" : "border-transparent"} transition-all`}
              title="자동"
            />
            <span className="text-xs text-muted-foreground ml-1">
              {colorIndex === null ? "자동 배정" : `색상 ${colorIndex + 1}`}
            </span>
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            담당 선생님 <span className="text-muted-foreground font-normal">(최대 2명)</span>
          </label>
          <input
            type="search"
            placeholder="선생님 이름 검색"
            value={teacherSearch}
            onChange={(e) => setTeacherSearch(e.target.value)}
            className="w-full rounded-lg border border-input px-3 py-1.5 text-sm text-foreground placeholder-muted-foreground bg-background mb-2"
          />
          <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-lg border border-input p-2">
            {filteredTeachers.map((t) => (
              <label
                key={t.id}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${
                  selectedTeacherIds.includes(t.id) ? "bg-primary/10" : "hover:bg-muted/50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedTeacherIds.includes(t.id)}
                  onChange={() => toggleTeacher(t.id)}
                  disabled={!selectedTeacherIds.includes(t.id) && selectedTeacherIds.length >= 2}
                  className="rounded"
                />
                <span className="text-sm text-foreground">{t.name}</span>
                <span className={`ml-auto rounded px-1.5 py-0.5 text-xs font-medium ${
                  t.teacher_type === "native" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                }`}>
                  {t.teacher_type === "native" ? "원어민" : "한국인"}
                </span>
              </label>
            ))}
            {teachers.length > 0 && filteredTeachers.length === 0 && (
              <p className="text-xs text-muted-foreground py-2 text-center">검색 결과 없음</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {pending ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AddStudentModal({
  classId,
  onClose,
  onSuccess,
}: {
  classId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [options, setOptions] = useState<
    {
      id: string;
      korean_name: string | null;
      english_name: string | null;
      student_number: string | null;
    }[]
  >([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    listStudentsNotInClass(classId).then((list) => {
      setOptions(list);
      setLoading(false);
    });
  }, [classId]);

  const filteredOptions = useMemo(() => {
    if (!studentSearch.trim()) return options;
    const q = studentSearch.trim().toLowerCase();
    return options.filter(
      (s) =>
        (s.korean_name && s.korean_name.toLowerCase().includes(q)) ||
        (s.english_name && s.english_name.toLowerCase().includes(q)) ||
        (s.student_number && s.student_number.toLowerCase().includes(q))
    );
  }, [options, studentSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setPending(true);
    setError(null);
    const result = await addStudentToClass(classId, selectedId);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onSuccess();
  };

  return (
    <Modal title="학생 추가" onClose={onClose}>
      {loading ? (
        <p className="py-4 text-center text-sm text-muted-foreground">불러오는 중…</p>
      ) : options.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          이 반에 추가할 수 있는 학생이 없습니다.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              학생 검색
            </label>
            <input
              type="search"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="이름 또는 학번으로 검색"
              className="w-full rounded-lg border border-input px-3 py-2 text-foreground placeholder-muted-foreground bg-background"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              학생 선택
            </label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-lg border border-input px-3 py-2 text-foreground bg-background"
              required
            >
              <option value="">선택하세요</option>
              {filteredOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {[s.korean_name, s.english_name].filter(Boolean).join(" / ")} (
                  {s.student_number ?? "—"})
                </option>
              ))}
            </select>
            {studentSearch && filteredOptions.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">검색 결과 없음</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {pending ? "추가 중…" : "추가"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-md rounded-xl border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="닫기"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}


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
import type { ClassWithDetails, ClassStudentRow, TeacherOption } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatStudentName } from "@/lib/utils/student-name";
import { ConfirmDialog } from "@/components/overlays/ConfirmDialog";
import { CLASS_COLOR_PALETTE, GROUP_TYPE_TO_LABEL } from "@/lib/constants/class";
import { getAgeColor } from "@/lib/ui/student-age-colors";
import { TeacherBadges } from "@/components/badges/TeacherBadges";
import { sortStudentsByAgeAndName } from "@/lib/utils/student-sort";
import type { SubTab } from "./ClassesPageClient";

type StudentInfo = {
  id: string;
  korean_name: string | null;
  english_name: string | null;
  age: number | null;
  group_type: string | null;
};

type FlatClassStudent = {
  class_id: string;
  id: string;
  student_profile_id: string;
  korean_name: string | null;
  english_name: string | null;
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
    </div>
  );
}

export function ClassesManager({
  initialClasses,
  teachers,
  allClassStudents,
  allStudents,
  subTab,
  onSubTabChange,
}: {
  initialClasses: ClassWithDetails[];
  teachers: TeacherOption[];
  allClassStudents: FlatClassStudent[];
  allStudents: StudentInfo[];
  subTab: SubTab;
  onSubTabChange: (sub: SubTab) => void;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editClass, setEditClass] = useState<ClassWithDetails | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClassWithDetails | null>(null);
  const [deleteTargetCounts, setDeleteTargetCounts] = useState<{ studentCount: number; homeworkCount: number; noticeCount: number } | null>(null);
  const [deleteTargetLoading, setDeleteTargetLoading] = useState(false);
  const [addStudentOpen, setAddStudentOpen] = useState<ClassWithDetails | null>(null);
  const [deleteClassPending, setDeleteClassPending] = useState(false);

  const [pendingAdds, setPendingAdds] = useState<Map<string, string>>(new Map());
  const [pendingRemoves, setPendingRemoves] = useState<Set<string>>(new Set());
  const [studentSaving, setStudentSaving] = useState(false);
  const hasPendingStudentChanges = pendingAdds.size > 0 || pendingRemoves.size > 0;

  const [rightSearch, setRightSearch] = useState("");

  const [dropTargetClassId, setDropTargetClassId] = useState<string | null>(null);

  const [notification, setNotification] = useState<{ type: "error" | "success"; message: string } | null>(null);

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
      });
    }
    return map;
  }, [effectiveClassStudents]);

  const studentClassMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const cs of effectiveClassStudents) {
      if (!map[cs.student_profile_id]) map[cs.student_profile_id] = [];
      const cls = initialClasses.find((c) => c.id === cs.class_id);
      if (cls) map[cs.student_profile_id].push(cls.name);
    }
    return map;
  }, [effectiveClassStudents, initialClasses]);

  const filteredClasses = useMemo(() => {
    const targetLabel = subTab === "kindergarten" ? "유치부" : "오후반";
    const nonAfterschool = initialClasses.filter((c) => GROUP_TYPE_TO_LABEL[c.group_type ?? ""] !== "방과후");
    let result = nonAfterschool.filter(
      (c) => (GROUP_TYPE_TO_LABEL[c.group_type ?? ""] ?? "") === targetLabel
    );
    if (activeOnly) result = result.filter((c) => c.schedule_count > 0);
    if (teacherFilter) result = result.filter((c) => c.teachers.some((t) => t.profile_id === teacherFilter));
    if (!search.trim()) return result;
    const q = search.trim().toLowerCase();
    return result.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      const gl = GROUP_TYPE_TO_LABEL[c.group_type ?? ""];
      if (gl && gl.toLowerCase().includes(q)) return true;
      const students = studentsByClassId[c.id] ?? [];
      return students.some(
        (s) =>
          (s.korean_name && s.korean_name.toLowerCase().includes(q)) ||
          (s.english_name && s.english_name.toLowerCase().includes(q))
      );
    });
  }, [initialClasses, search, subTab, teacherFilter, activeOnly, studentsByClassId]);

  const filteredRightStudents = useMemo(() => {
    const target = subTab === "kindergarten" ? "유치부" : "오후반";
    let unassigned = allStudents.filter(
      (s) => !studentClassMap[s.id] || studentClassMap[s.id].length === 0
    );
    unassigned = unassigned.filter((s) => s.group_type === target);
    if (rightSearch.trim()) {
      const q = rightSearch.trim().toLowerCase();
      unassigned = unassigned.filter(
        (s) =>
          (s.korean_name && s.korean_name.toLowerCase().includes(q)) ||
          (s.english_name && s.english_name.toLowerCase().includes(q))
      );
    }
    return sortStudentsByAgeAndName(unassigned);
  }, [allStudents, studentClassMap, rightSearch, subTab]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleDropStudentToCard = (classId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDropTargetClassId(null);

    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return; }
    if (parsed.type !== "student") return;

    const { studentProfileId } = parsed;

    const existing = studentsByClassId[classId] ?? [];
    if (existing.some((s) => s.student_profile_id === studentProfileId)) {
      setNotification({ type: "error", message: "이미 이 반에 소속된 학생입니다." });
      return;
    }

    const currentEntry = effectiveClassStudents.find(
      (cs) => cs.student_profile_id === studentProfileId
    );
    if (currentEntry) {
      if (currentEntry.id.startsWith("pending-")) {
        setPendingAdds((prev) => new Map([...prev, [studentProfileId, classId]]));
      } else {
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

  const handleRemoveStudentPending = (row: ClassStudentRow) => {
    if (row.id.startsWith("pending-")) {
      setPendingAdds((prev) => {
        const next = new Map(prev);
        next.delete(row.student_profile_id);
        return next;
      });
    } else {
      setPendingRemoves((prev) => new Set([...prev, row.id]));
    }
  };

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

  return (
    <div className="space-y-4">
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

      {/* sub-tab nav */}
      <nav className="flex border-b">
        <button
          type="button"
          onClick={() => onSubTabChange("kindergarten")}
          className={`px-5 py-3 text-base font-medium ${
            subTab === "kindergarten"
              ? "text-amber-700 border-b-2 border-amber-500 bg-amber-50"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          🌅 유치부 관리
        </button>
        <button
          type="button"
          onClick={() => onSubTabChange("afternoon")}
          className={`px-5 py-3 text-base font-medium ${
            subTab === "afternoon"
              ? "text-sky-700 border-b-2 border-sky-500 bg-sky-50"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          ☁️ 오후반 관리
        </button>
      </nav>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-3">
          <div className="rounded-xl border bg-card p-3">
            <div className="flex items-center gap-2 mb-2">
              <svg className="size-4 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="search"
                placeholder="반 이름 · 학생 이름 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-0 rounded-lg border border-input px-3 py-1.5 text-sm text-foreground placeholder-muted-foreground bg-background"
              />
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
              오른쪽에서 학생을 드래그하여 반에 추가하세요
            </p>
          </div>

          <div className="space-y-2 max-h-[calc(100vh-240px)] overflow-y-auto pr-1">
            {filteredClasses.length === 0 ? (
              <div className="rounded-xl border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                {search.trim() || teacherFilter || activeOnly ? "검색 결과가 없습니다." : "등록된 반이 없습니다. 반 추가로 생성하세요."}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredClasses.map((c) => (
                  <ClassCard
                    key={c.id}
                    classRow={c}
                    students={studentsByClassId[c.id] ?? []}
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
                    isDropTarget={dropTargetClassId === c.id}
                    onDragOver={() => setDropTargetClassId(c.id)}
                    onDragLeave={() => setDropTargetClassId(null)}
                    onDrop={(e) => handleDropStudentToCard(c.id, e)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:sticky lg:top-6 self-start space-y-3">
          <div className="rounded-xl border-2 border-primary/30 bg-card overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white text-center flex items-center justify-center gap-1.5">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
              학생 관리
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">미배정 학생</h3>
                <span className="text-xs text-muted-foreground">{filteredRightStudents.length}명</span>
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
                placeholder="이름 검색"
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
                ) : subTab === "afternoon" ? (
                  <div className="space-y-0.5">
                    {filteredRightStudents.map((s) => (
                      <UnassignedStudentItem key={s.id} s={s} showAgeBadge={false} />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {filteredRightStudents.map((s) => (
                      <UnassignedStudentItem key={s.id} s={s} showAgeBadge={true} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {createOpen && (
        <AddClassModal
          teachers={teachers}
          defaultGroupLabel={subTab === "kindergarten" ? "유치부" : "오후반"}
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

function ClassCard({
  classRow,
  students,
  onEdit,
  onDelete,
  onRemoveStudent,
  isDropTarget,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  classRow: ClassWithDetails;
  students: ClassStudentRow[];
  onEdit: () => void;
  onDelete: () => void;
  onRemoveStudent: (row: ClassStudentRow) => void;
  isDropTarget: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div
      className={`rounded-xl border-2 bg-card overflow-hidden transition-all ${
        isDropTarget
          ? "border-emerald-400 bg-emerald-50/30 shadow-md"
          : "border-border"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!isDropTarget) onDragOver();
      }}
      onDragLeave={(e) => {
        // 자식 요소(span, button)로 커서가 옮겨가도 onDragLeave 가 발화하므로,
        // 카드 자체를 진짜로 떠난 경우만 leave 처리. 깜빡임 방지.
        const related = e.relatedTarget as Node | null;
        if (related && (e.currentTarget as Node).contains(related)) return;
        onDragLeave();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDrop(e);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-foreground">{classRow.name}</span>
          <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-base font-medium text-violet-700">
            {classRow.student_count}명
          </span>
          {isDropTarget && (
            <span className="text-sm font-medium animate-pulse text-emerald-600">
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

      <div className="px-4 py-2.5">
        {students.length === 0 ? (
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
        )}
      </div>
    </div>
  );
}

function AddClassModal({
  teachers,
  defaultGroupLabel,
  onClose,
  onSuccess,
}: {
  teachers: TeacherOption[];
  defaultGroupLabel: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [groupLabel, setGroupLabel] = useState(defaultGroupLabel);
  const [colorIndex, setColorIndex] = useState<number | null>(null);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (groupLabel === "유치부") setDaysOfWeek([1, 2, 3, 4, 5]);
  }, [groupLabel]);

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
    if (daysOfWeek.length === 0) return;
    setPending(true);
    setError(null);
    const result = await createClass(name.trim(), selectedTeacherIds, groupLabel, colorIndex, daysOfWeek);
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
              <option value="유치부">유치부</option>
              <option value="오후반">오후반</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            요일{" "}
            <span className="text-muted-foreground font-normal">
              {groupLabel === "유치부" ? "(월~금 고정)" : "(최소 1개)"}
            </span>
          </label>
          <div className="flex gap-2">
            {[
              { val: 1, label: "월" },
              { val: 2, label: "화" },
              { val: 3, label: "수" },
              { val: 4, label: "목" },
              { val: 5, label: "금" },
            ].map((d) => (
              <label
                key={d.val}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                  daysOfWeek.includes(d.val)
                    ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600"
                } ${groupLabel === "유치부" ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={daysOfWeek.includes(d.val)}
                  disabled={groupLabel === "유치부"}
                  onChange={() => {
                    setDaysOfWeek((prev) =>
                      prev.includes(d.val)
                        ? prev.filter((v) => v !== d.val)
                        : [...prev, d.val].sort()
                    );
                  }}
                  className="sr-only"
                />
                {d.label}
              </label>
            ))}
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
            disabled={pending || daysOfWeek.length === 0}
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
  const [groupLabel, setGroupLabel] = useState(GROUP_TYPE_TO_LABEL[classRow.group_type ?? ""] ?? "유치부");
  const [colorIndex, setColorIndex] = useState<number | null>(classRow.color_index ?? null);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>(
    classRow.teachers.map((t) => t.profile_id)
  );
  const [teacherSearch, setTeacherSearch] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(classRow.days_of_week ?? [1, 2, 3, 4, 5]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (groupLabel === "유치부") setDaysOfWeek([1, 2, 3, 4, 5]);
  }, [groupLabel]);

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

  const removedDays = useMemo(() => {
    const initialDays = classRow.days_of_week ?? [1, 2, 3, 4, 5];
    return initialDays.filter((d) => !daysOfWeek.includes(d));
  }, [classRow.days_of_week, daysOfWeek]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (daysOfWeek.length === 0) return;
    setPending(true);
    setError(null);
    const result = await updateClass(
      classRow.id,
      name.trim(),
      selectedTeacherIds,
      groupLabel,
      colorIndex,
      daysOfWeek,
    );
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onSuccess();
  };

  const dayLabels: Record<number, string> = { 1: "월", 2: "화", 3: "수", 4: "목", 5: "금" };

  return (
    <Modal title="반 수정" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {removedDays.length > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
            ⚠ 선택 해제한 요일({removedDays.map((d) => dayLabels[d]).join(", ")})의 수업 배정도 함께 삭제됩니다.
          </div>
        )}
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
              <option value="유치부">유치부</option>
              <option value="오후반">오후반</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            요일{" "}
            <span className="text-muted-foreground font-normal">
              {groupLabel === "유치부" ? "(월~금 고정)" : "(최소 1개)"}
            </span>
          </label>
          <div className="flex gap-2">
            {[
              { val: 1, label: "월" },
              { val: 2, label: "화" },
              { val: 3, label: "수" },
              { val: 4, label: "목" },
              { val: 5, label: "금" },
            ].map((d) => (
              <label
                key={d.val}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                  daysOfWeek.includes(d.val)
                    ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600"
                } ${groupLabel === "유치부" ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={daysOfWeek.includes(d.val)}
                  disabled={groupLabel === "유치부"}
                  onChange={() => {
                    setDaysOfWeek((prev) =>
                      prev.includes(d.val)
                        ? prev.filter((v) => v !== d.val)
                        : [...prev, d.val].sort()
                    );
                  }}
                  className="sr-only"
                />
                {d.label}
              </label>
            ))}
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
            disabled={pending || daysOfWeek.length === 0}
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
        (s.english_name && s.english_name.toLowerCase().includes(q))
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
              placeholder="이름으로 검색"
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
                  {[s.korean_name, s.english_name].filter(Boolean).join(" / ")}
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

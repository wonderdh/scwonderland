"use client";

import { useEffect, useState } from "react";
import type {
  ClassUnitProgressDetailed,
  UnitStatus,
} from "@/app/(admin)/admin/actions";
import { UnitProgressGrid } from "@/components/homework/UnitProgressGrid";

type Props = {
  students: ClassUnitProgressDetailed["students"];
  byStudent: ClassUnitProgressDetailed["byStudent"];
  editable?: boolean;
  /** 반 전체 변경사항 일괄 저장. grouped by studentId+textbookId. */
  onSave?: (
    allChanges: {
      studentId: string;
      textbookId: string;
      changes: { unitNumber: number; status: UnitStatus }[];
    }[]
  ) => Promise<void>;
  loading?: boolean;
  emptyMessage?: string;
  /** 오늘 결석한 student_id set. 결석자 행은 회색 + "결석" 뱃지 + 클릭 비활성화. */
  absentStudentIds?: ReadonlySet<string>;
};

const NEXT_STATUS: Record<UnitStatus, UnitStatus> = {
  pending: "completed",
  completed: "missed",
  missed: "pending",
};

/** pending 변경 key: "studentId:textbookId:unitNumber" */
type PendingKey = string;

export function ClassUnitProgressList({
  students,
  byStudent,
  editable = false,
  onSave,
  loading = false,
  emptyMessage = "이 반에 등록된 학생이 없습니다.",
  absentStudentIds,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // 로컬 표시용 데이터 (미저장 변경 반영)
  const [localByStudent, setLocalByStudent] = useState(byStudent);
  // key → 변경된 status
  const [pendingMap, setPendingMap] = useState<Map<PendingKey, UnitStatus>>(new Map());
  const [isSaving, setIsSaving] = useState(false);

  // 반 전환 / 부모 reload 시 동기화
  useEffect(() => {
    setLocalByStudent(byStudent);
    setPendingMap(new Map());
    setCollapsed(new Set());
  }, [byStudent]);

  function toggle(studentId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function handleUnitClick(studentId: string, textbookId: string, unitNumber: number) {
    if (absentStudentIds?.has(studentId)) return;
    const list = localByStudent[studentId];
    const tb = list?.find((t) => t.id === textbookId);
    const unit = tb?.units.find((u) => u.unitNumber === unitNumber);
    if (!unit) return;

    const nextStatus = NEXT_STATUS[unit.status];

    setLocalByStudent((prev) => {
      const prevList = prev[studentId];
      if (!prevList) return prev;
      return {
        ...prev,
        [studentId]: prevList.map((t) =>
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

    setPendingMap((prev) => {
      const next = new Map(prev);
      const key: PendingKey = `${studentId}:${textbookId}:${unitNumber}`;
      const original = byStudent[studentId]?.find((t) => t.id === textbookId)?.units.find(
        (u) => u.unitNumber === unitNumber
      );
      if (original && original.status === nextStatus) {
        next.delete(key);
      } else {
        next.set(key, nextStatus);
      }
      return next;
    });
  }

  function handleCancel() {
    setLocalByStudent(byStudent);
    setPendingMap(new Map());
  }

  async function handleSave() {
    if (!onSave || pendingMap.size === 0 || isSaving) return;

    // pending 변경을 studentId+textbookId 별로 그룹화
    const grouped = new Map<
      string,
      { studentId: string; textbookId: string; changes: { unitNumber: number; status: UnitStatus }[] }
    >();
    for (const [key, status] of pendingMap) {
      const colonIdx1 = key.indexOf(":");
      const colonIdx2 = key.indexOf(":", colonIdx1 + 1);
      const studentId = key.slice(0, colonIdx1);
      const textbookId = key.slice(colonIdx1 + 1, colonIdx2);
      const unitNumber = Number(key.slice(colonIdx2 + 1));
      const groupKey = `${studentId}:${textbookId}`;
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, { studentId, textbookId, changes: [] });
      }
      grouped.get(groupKey)!.changes.push({ unitNumber, status });
    }

    setIsSaving(true);
    try {
      await onSave([...grouped.values()]);
      // 성공 시 부모가 byStudent 갱신 → useEffect 가 pendingMap 초기화
    } catch {
      // 에러는 부모(onSave)에서 toast 처리
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-card py-12 text-center">
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="rounded-xl border bg-card py-12 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 컨트롤 + 가이드 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {editable ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 flex-1 min-w-0">
            셀 클릭: <span className="font-semibold">미완료</span> →{" "}
            <span className="font-semibold text-emerald-700">완료</span> →{" "}
            <span className="font-semibold text-red-600">결손</span> →{" "}
            <span className="font-semibold">미완료</span>. 빨강 점선 = 예정일 지남, amber = 오늘 예정.
            변경 후 하단 <span className="font-semibold">저장</span> 버튼으로 반 전체 일괄 저장.
          </div>
        ) : (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700 flex-1 min-w-0">
            <span className="text-emerald-700 font-semibold">완료</span> /{" "}
            <span className="text-red-600 font-semibold">결손</span> / 점선 = 예정일 지남 / amber = 오늘
            예정 (읽기 전용)
          </div>
        )}
        <div className="flex gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setCollapsed(new Set())}
            className="px-3 py-1 text-xs rounded-md border border-slate-200 hover:bg-slate-50"
          >
            모두 펼치기
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(new Set(students.map((s) => s.id)))}
            className="px-3 py-1 text-xs rounded-md border border-slate-200 hover:bg-slate-50"
          >
            모두 접기
          </button>
        </div>
      </div>

      {/* 학생 카드 */}
      <div className="space-y-4">
        {students.map((student) => {
          const list = localByStudent[student.id] ?? [];
          const isCollapsed = collapsed.has(student.id);
          const isAbsent = absentStudentIds?.has(student.id) ?? false;

          return (
            <section
              key={student.id}
              className={`rounded-xl border shadow-sm overflow-hidden ${isAbsent ? "border-slate-200 bg-slate-100/70" : "border-slate-200 bg-white"}`}
            >
              <button
                type="button"
                onClick={() => toggle(student.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-slate-200 transition-colors text-left ${isAbsent ? "bg-slate-100 hover:bg-slate-150" : "bg-slate-50/60 hover:bg-slate-100"}`}
              >
                <span
                  className={`text-slate-500 transition-transform shrink-0 ${isCollapsed ? "" : "rotate-90"}`}
                >
                  ▶
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold truncate ${isAbsent ? "text-slate-500" : "text-slate-900"}`}>
                      {student.korean_name ?? student.id.slice(0, 6)}
                      {student.english_name && (
                        <span className="ml-1.5 text-xs font-normal text-slate-400">
                          ({student.english_name})
                        </span>
                      )}
                    </p>
                    {isAbsent && (
                      <span className="inline-flex items-center rounded-full bg-slate-300 px-2 py-0.5 text-[11px] font-semibold text-slate-600 shrink-0">
                        결석
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{list.length}권 부여</p>
                </div>
              </button>

              {!isCollapsed && (
                <div className="p-3 space-y-3">
                  {list.length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-400">부여된 책이 없습니다.</p>
                  ) : (
                    list.map((tb) => {
                      const dirtyNumbers = new Set(
                        [...pendingMap.keys()]
                          .filter((k) => k.startsWith(`${student.id}:${tb.id}:`))
                          .map((k) => Number(k.split(":")[2]))
                      );
                      return (
                        <UnitProgressGrid
                          key={tb.id}
                          textbook={tb}
                          units={tb.units}
                          editable={editable && !isAbsent}
                          dirtyNumbers={dirtyNumbers}
                          onUnitClick={
                            editable && !isAbsent
                              ? (unitNumber) => handleUnitClick(student.id, tb.id, unitNumber)
                              : undefined
                          }
                        />
                      );
                    })
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* 반 전체 저장 바 */}
      {editable && pendingMap.size > 0 && (
        <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 shadow-lg">
          <span className="text-sm text-orange-700 font-medium">
            {pendingMap.size}건 변경됨 (미저장)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 border border-slate-200 bg-white transition-colors disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary/90 border border-primary transition-colors disabled:opacity-50"
            >
              {isSaving ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

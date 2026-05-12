"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  startTransition as reactStartTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/overlays/ConfirmDialog";
import {
  listClassUnitProgressDetailed,
  listClassTextbooks,
  unassignClassTextbook,
  markUnit,
} from "@/app/(admin)/admin/actions";
import type {
  ClassUnitProgressDetailed,
  ClassTextbookWithDetails,
  HomeworkClassPickerOption,
  UnitStatus,
} from "@/app/(admin)/admin/actions";
import { ClassUnitProgressList } from "@/components/homework/ClassUnitProgressList";
import { KST_DAY_LABELS } from "@/lib/utils/date-kst";
import { AssignClassHomeworkModal } from "./AssignClassHomeworkModal";
import { EditClassHomeworkModal } from "./EditClassHomeworkModal";
import type { Database } from "@/lib/types/database.generated";

type TextbookRow = Database["public"]["Tables"]["homework_books"]["Row"];
type ClassOption = HomeworkClassPickerOption;

function buildSearchHaystack(c: ClassOption): string {
  const parts = [
    c.name,
    ...c.teacherNames,
    ...c.studentNames.flatMap((s) => [s.ko ?? "", s.en ?? ""]),
  ];
  return parts.join(" ").toLowerCase();
}

function DayChips({ days }: { days: number[] }) {
  if (!days || days.length === 0) {
    return <span className="text-xs text-amber-600">요일 미지정</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {[...days]
        .sort((a, b) => a - b)
        .map((d) => (
          <span
            key={d}
            className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-100 px-1.5 text-[11px] font-semibold text-orange-700"
          >
            {KST_DAY_LABELS[d]}
          </span>
        ))}
    </div>
  );
}

type Props = {
  classes: ClassOption[];
  initialClassId: string | null;
  initialProgress: ClassUnitProgressDetailed;
  initialAssignments: ClassTextbookWithDetails[];
  allTextbooks: TextbookRow[];
};

export function ClassHomeworkManageTab({
  classes,
  initialClassId,
  initialProgress,
  initialAssignments,
  allTextbooks,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(initialClassId);
  const [progress, setProgress] = useState<ClassUnitProgressDetailed>(initialProgress);
  const [assignments, setAssignments] = useState<ClassTextbookWithDetails[]>(initialAssignments);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ClassTextbookWithDetails | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ClassTextbookWithDetails | null>(null);

  const haystacks = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of classes) m.set(c.id, buildSearchHaystack(c));
    return m;
  }, [classes]);

  const filteredClasses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter((c) => {
      if (c.id === selectedClassId) return true;
      return (haystacks.get(c.id) ?? "").includes(q);
    });
  }, [classes, search, selectedClassId, haystacks]);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId) ?? null,
    [classes, selectedClassId]
  );

  async function reloadAll(classId: string) {
    const [nextProgress, nextAssignments] = await Promise.all([
      listClassUnitProgressDetailed(classId),
      listClassTextbooks(classId),
    ]);
    setProgress(nextProgress);
    setAssignments(nextAssignments);
  }

  function handleClassChange(classId: string) {
    setSelectedClassId(classId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "class");
    params.set("class", classId);
    router.replace(`/admin/homework?${params.toString()}`, { scroll: false });
    startTransition(async () => {
      await reloadAll(classId);
    });
  }

  useEffect(() => {
    if (initialClassId === selectedClassId) return;
    reactStartTransition(() => {
      setSelectedClassId(initialClassId);
      setProgress(initialProgress);
      setAssignments(initialAssignments);
    });
  }, [initialClassId, selectedClassId, initialProgress, initialAssignments]);

  function handleSaved() {
    if (!selectedClassId) return;
    startTransition(async () => {
      await reloadAll(selectedClassId);
    });
  }

  function handleRemove() {
    if (!removeTarget || !selectedClassId) return;
    const target = removeTarget;
    startTransition(async () => {
      const result = await unassignClassTextbook(target.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("숙제가 제거됐습니다.");
        await reloadAll(selectedClassId);
      }
      setRemoveTarget(null);
    });
  }

  async function handleMarkUnit(
    studentId: string,
    textbookId: string,
    unitNumber: number,
    nextStatus: UnitStatus
  ) {
    const fd = new FormData();
    fd.set("studentId", studentId);
    fd.set("textbookId", textbookId);
    fd.set("unitNumber", String(unitNumber));
    fd.set("status", nextStatus);
    const result = await markUnit(fd);
    if (result.error) {
      toast.error(result.error);
      if (selectedClassId) await reloadAll(selectedClassId);
      throw new Error(result.error);
    }
    setProgress((prev) => {
      const list = prev.byStudent[studentId];
      if (!list) return prev;
      const nextList = list.map((tb) =>
        tb.id === textbookId
          ? {
              ...tb,
              units: tb.units.map((u) =>
                u.unitNumber === unitNumber
                  ? {
                      ...u,
                      status: nextStatus,
                      completedAt:
                        nextStatus === "completed"
                          ? new Date().toISOString()
                          : null,
                    }
                  : u
              ),
            }
          : tb
      );
      return {
        ...prev,
        byStudent: { ...prev.byStudent, [studentId]: nextList },
      };
    });
  }

  const assignedTextbookIds = new Set(assignments.map((a) => a.textbook_id));

  if (classes.length === 0) {
    return (
      <div className="rounded-xl border bg-card py-12 text-center">
        <p className="text-sm text-muted-foreground">반이 없습니다.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          반 관리에서 먼저 반을 생성하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 반 검색 + selector */}
      <div className="space-y-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="반 이름 / 학생 한글·영어 이름 / 선생님 이름으로 검색"
          className="h-9 w-full max-w-md rounded-md border border-slate-200 bg-white px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {filteredClasses.length === 0 ? (
          <p className="text-xs text-slate-500">검색 결과가 없습니다.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {filteredClasses.map((cls) => (
              <button
                key={cls.id}
                type="button"
                onClick={() => handleClassChange(cls.id)}
                disabled={isPending}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  cls.id === selectedClassId
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:border-primary/50 hover:text-primary"
                } disabled:opacity-50`}
              >
                {cls.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedClass && (
        <>
          {/* 부여 섹션 */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                {selectedClass.name} · 부여된 숙제{" "}
                <span className="text-slate-500 font-normal">
                  ({assignments.length}권)
                </span>
              </h3>
              <Button size="sm" onClick={() => setAssignOpen(true)}>
                + 숙제 부여
              </Button>
            </div>

            {assignments.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-slate-50/50 p-6 text-center text-sm text-slate-400">
                부여된 숙제가 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {assignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      {a.cover_image_url ? (
                        <Image
                          src={a.cover_image_url}
                          alt={a.title}
                          width={48}
                          height={64}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300 text-xs">
                          ?
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {a.title}
                      </p>
                      {a.series && (
                        <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                          {a.series}
                        </span>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <DayChips days={(a as ClassTextbookWithDetails & { homework_days?: number[] }).homework_days ?? []} />
                        {a.start_date && (
                          <span className="text-xs text-slate-500">
                            시작 {a.start_date}
                          </span>
                        )}
                        {a.skip_dates && a.skip_dates.length > 0 && (
                          <span className="inline-flex h-5 items-center rounded-full bg-amber-100 px-2 text-[11px] font-medium text-amber-800">
                            예외 {a.skip_dates.length}일
                          </span>
                        )}
                      </div>
                      {a.note && (
                        <p className="text-xs text-slate-400 truncate">
                          {a.note}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => setEditTarget(a)}
                        className="rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemoveTarget(a)}
                        className="rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50 transition-colors"
                      >
                        제거
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 진도 섹션 */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">학생별 진도</h3>
            <ClassUnitProgressList
              students={progress.students}
              byStudent={progress.byStudent}
              editable={true}
              onMark={handleMarkUnit}
              loading={isPending}
            />
          </section>
        </>
      )}

      {assignOpen && selectedClassId && (
        <AssignClassHomeworkModal
          classId={selectedClassId}
          textbooks={allTextbooks}
          assignedTextbookIds={assignedTextbookIds}
          onClose={() => setAssignOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {editTarget && (
        <EditClassHomeworkModal
          assignment={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}

      <ConfirmDialog
        open={!!removeTarget}
        title="숙제 제거"
        description={`"${removeTarget?.title}" 을(를) 이 반에서 제거하시겠습니까?`}
        confirmLabel="제거"
        variant="danger"
        onConfirm={handleRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}

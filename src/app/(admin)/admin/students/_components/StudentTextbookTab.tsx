"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/overlays/ConfirmDialog";
import { Modal } from "@/components/overlays/Modal";
import { SeriesLevelPicker } from "@/components/forms/SeriesLevelPicker";
import { DayChips } from "@/components/badges/DayChips";
import {
  listStudentTextbooks,
  assignStudentTextbook,
  unassignStudentTextbook,
  type StudentTextbookWithDetails,
} from "@/app/(admin)/admin/actions/class-textbook-actions";
import {
  listTextbooks,
} from "@/app/(admin)/admin/actions/textbook-actions";

import type { Database } from "@/lib/types/database.generated";
import { BookOpen } from "lucide-react";

type TextbookRow = Database["public"]["Tables"]["homework_books"]["Row"] & {
  series_name?: string | null;
};

// ── Assign Modal ─────────────────────────────────────────────────────────────

function AssignModal({
  studentId,
  textbooks,
  assignedTextbookIds,
  onClose,
  onSaved,
}: {
  studentId: string;
  textbooks: TextbookRow[];
  assignedTextbookIds: Set<string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedTextbookId, setSelectedTextbookId] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit() {
    setFormError(null);
    if (!selectedTextbookId) {
      setFormError("숙제를 선택해 주세요.");
      return;
    }
    const fd = new FormData();
    fd.set("studentId", studentId);
    fd.set("textbookId", selectedTextbookId);
    fd.set("homeworkDays", "");
    fd.set("note", note);

    startTransition(async () => {
      const result = await assignStudentTextbook(fd);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      toast.success("숙제가 부여됐습니다.");
      onSaved();
      onClose();
    });
  }

  return (
    <Modal open onClose={onClose}>
      <div className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          개인 숙제 부여
        </h2>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              숙제 선택 <span className="text-red-500">*</span>
            </label>
            <SeriesLevelPicker
              textbooks={textbooks}
              assignedTextbookIds={assignedTextbookIds}
              value={selectedTextbookId}
              onChange={setSelectedTextbookId}
              disabled={isPending}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              메모
            </label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="메모 (선택)"
              disabled={isPending}
              className="h-10"
            />
          </div>

          <p className="text-xs text-slate-400">
            숙제 요일은 한국 교사가 숙제 페이지에서 설정합니다.
          </p>

          {formError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isPending}
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending ? "저장 중..." : "부여"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Main Tab ──────────────────────────────────────────────────────────────────

export function StudentTextbookTab({
  studentProfileId,
}: {
  studentProfileId: string;
}) {
  const [individualAssignments, setIndividualAssignments] = useState<
    StudentTextbookWithDetails[] | null
  >(null);
  const [allTextbooks, setAllTextbooks] = useState<TextbookRow[]>([]);
  const [, startTransition] = useTransition();

  const [assignOpen, setAssignOpen] = useState(false);
  const [removeTarget, setRemoveTarget] =
    useState<StudentTextbookWithDetails | null>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      const [indiv, texts] = await Promise.all([
        listStudentTextbooks(studentProfileId),
        listTextbooks(),
      ]);
      setIndividualAssignments(indiv);
      setAllTextbooks(texts);
    });
  }, [studentProfileId]);

  useEffect(() => {
    load();
  }, [load]);

  // 첫 로드 (initial fetch in flight) 와 이후 transition 모두 isPending 으로 통일.
  const isInitialLoad = individualAssignments === null;

  function handleRemove() {
    if (!removeTarget) return;
    startTransition(async () => {
      const result = await unassignStudentTextbook(removeTarget.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("숙제가 제거됐습니다.");
        setIndividualAssignments((prev) =>
          prev ? prev.filter((a) => a.id !== removeTarget.id) : prev
        );
      }
      setRemoveTarget(null);
    });
  }

  const assignedTextbookIds = new Set(
    (individualAssignments ?? [])
      .map((a) => a.textbook_id)
      .filter((id): id is string => !!id)
  );

  if (isInitialLoad) {
    return (
      <div className="py-8 text-center text-sm text-slate-400">
        숙제 정보를 불러오는 중...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 안내 — 진도 체크는 별도 페이지로 */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5 text-xs text-blue-800">
        진도 체크는{" "}
        <Link
          href="/admin/homework?tab=check"
          className="font-semibold underline hover:text-blue-900"
        >
          숙제 관리 → 반별 체크
        </Link>{" "}
        탭에서 한 번에 관리합니다. 이 화면은 개인 부여 (반 외 추가 책) 만 다룹니다.
      </div>

      {/* Individual assignments section */}
      <section>
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">
            개인 부여 ({(individualAssignments ?? []).length}권)
          </h3>
          <Button size="sm" onClick={() => setAssignOpen(true)}>
            + 숙제 부여
          </Button>
        </div>

        {(individualAssignments ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">
            개인 부여된 숙제가 없습니다. (반 부여는 반 관리에서 진행)
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(individualAssignments ?? []).map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                {/* Cover thumbnail */}
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
                    <div className="flex h-full w-full items-center justify-center">
                      <BookOpen className="h-6 w-6 text-slate-300" strokeWidth={1.5} />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {a.series && (
                      <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                        {a.series}
                      </span>
                    )}
                    {a.level && (
                      <span className="inline-block rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                        {a.level}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <DayChips days={a.homework_days ?? []} size="md" />
                    {a.skip_dates && a.skip_dates.length > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        예외 {a.skip_dates.length}일
                      </span>
                    )}
                  </div>
                  {a.note && (
                    <p className="text-xs text-slate-400 truncate">{a.note}</p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col gap-1">
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

      {assignOpen && (
        <AssignModal
          studentId={studentProfileId}
          textbooks={allTextbooks}
          assignedTextbookIds={assignedTextbookIds}
          onClose={() => setAssignOpen(false)}
          onSaved={load}
        />
      )}

      <ConfirmDialog
        open={!!removeTarget}
        title="숙제 제거"
        description={`"${removeTarget?.title}" 을(를) 이 학생에서 제거하시겠습니까?`}
        confirmLabel="제거"
        variant="danger"
        onConfirm={handleRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}

"use client";

import {
  listStudentProgress,
  listTextbooksNotAssignedToStudent,
  assignTextbookToStudent,
  removeTextbookFromStudent,
  updateProgress,
} from "../../actions/textbook-actions";
import type { StudentTextbookProgress, Textbook } from "@/lib/types";
import { TEXTBOOK_CATEGORIES } from "../../actions/textbook-constants";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAsyncData } from "../../hooks/useAsyncData";
import { LoadingState } from "@/components/LoadingState";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const STATUS_MAP = {
  not_started: { label: "시작 전", color: "bg-slate-100 text-slate-600" },
  in_progress: { label: "진행 중", color: "bg-blue-100 text-blue-700" },
  completed: { label: "완료", color: "bg-emerald-100 text-emerald-700" },
} as const;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function toInputDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function TextbookCard({
  p,
  onEdit,
  onRemove,
  dimmed,
}: {
  p: StudentTextbookProgress;
  onEdit: () => void;
  onRemove?: () => void;
  dimmed?: boolean;
}) {
  const pct = p.total_units > 0 ? Math.round((p.completed_units / p.total_units) * 100) : 0;
  const st = STATUS_MAP[p.status];
  const catLabel = TEXTBOOK_CATEGORIES.find((c) => c.value === p.textbook_category)?.label ?? p.textbook_category;

  return (
    <div
      className={`group rounded-lg border border-slate-200 bg-white flex flex-col hover:shadow-sm transition-shadow overflow-hidden ${dimmed ? "opacity-75" : ""}`}
      style={{ width: 170 }}
    >
      {/* 커버 이미지 */}
      {p.textbook_cover_image ? (
        <div className="flex items-center justify-center bg-slate-50">
          <Image
            src={p.textbook_cover_image}
            alt={p.textbook_title}
            width={170}
            height={190}
            className="object-cover"
            style={{ width: 170, height: 190 }}
            sizes="170px"
          />
        </div>
      ) : (
        <div className="flex items-center justify-center bg-slate-50" style={{ width: 170, height: 190 }}>
          <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-1 p-2.5">
        {/* 제목 + 상태 */}
        <div className="flex items-start gap-1">
          <h3 className="text-sm font-semibold text-slate-800 truncate leading-tight flex-1">{p.textbook_title}</h3>
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${st.color}`}>
            {st.label}
          </span>
        </div>

        {/* 시리즈 */}
        {p.textbook_series && (
          <p className="text-xs text-slate-500 truncate">{p.textbook_series}</p>
        )}

        {/* 메타 정보 */}
        <div className="flex items-center gap-1 flex-wrap text-xs text-slate-500">
          <span className="rounded bg-blue-50 px-1 py-0.5 text-blue-700 font-medium">{catLabel}</span>
          {p.textbook_level && (
            <span className="rounded bg-slate-100 px-1 py-0.5">Lv.{p.textbook_level}</span>
          )}
          <span className="rounded bg-slate-50 px-1 py-0.5">
            {p.source_type === "class" ? "반" : "개별"}
          </span>
        </div>

        {/* 진도 바 */}
        <div className="mt-1">
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                pct >= 100 ? "bg-emerald-500" : "bg-blue-500"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs font-medium text-slate-500 mt-0.5 text-right">
            {p.completed_units}/{p.total_units} ({pct}%)
          </p>
        </div>

        {/* 날짜 정보 */}
        <div className="text-xs text-slate-400 space-y-0.5 border-t border-slate-100 pt-1">
          <div className="flex justify-between">
            <span>배정일</span>
            <span className="text-slate-600">{formatDate(p.assigned_at)}</span>
          </div>
          {p.status === "completed" && p.completed_at && (
            <div className="flex justify-between">
              <span>완료일</span>
              <span className="text-emerald-600">{formatDate(p.completed_at)}</span>
            </div>
          )}
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-1 mt-auto pt-1 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onEdit}
            className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors"
          >
            수정
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
            >
              제거
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function StudentTextbookTab({ studentProfileId }: { studentProfileId: string }) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StudentTextbookProgress | null>(null);
  const [removeTarget, setRemoveTarget] = useState<StudentTextbookProgress | null>(null);
  const [removePending, setRemovePending] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const { data: progress, loading, reload } = useAsyncData(
    () => listStudentProgress(studentProfileId),
    [studentProfileId],
  );

  const activeBooks = (progress ?? []).filter((p) => p.status !== "completed");
  const completedBooks = (progress ?? []).filter((p) => p.status === "completed");

  if (loading && !progress) {
    return <LoadingState label="교재 불러오는 중..." />;
  }

  return (
    <div className="space-y-6">
      {/* 진행 중 교재 섹션 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">배정된 교재</h2>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
          >
            + 교재 배정
          </button>
        </div>

        {activeBooks.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <p className="text-sm font-medium text-slate-500 mb-1">
              {(progress ?? []).length === 0 ? "배정된 교재가 없습니다" : "진행 중인 교재가 없습니다"}
            </p>
            <p className="text-xs text-slate-400">
              {(progress ?? []).length === 0
                ? "위의 '교재 배정' 버튼으로 교재를 배정해 주세요."
                : "모든 교재를 완료했습니다!"}
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {activeBooks.map((p) => (
              <TextbookCard
                key={p.id}
                p={p}
                onEdit={() => setEditTarget(p)}
                onRemove={p.source_type === "individual" ? () => setRemoveTarget(p) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* 완료 교재 섹션 */}
      {completedBooks.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
          >
            <svg
              className={`h-4 w-4 transition-transform ${showCompleted ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            완료 교재
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              {completedBooks.length}
            </span>
          </button>

          {showCompleted && (
            <div className="flex flex-wrap gap-3">
              {completedBooks.map((p) => (
                <TextbookCard
                  key={p.id}
                  p={p}
                  dimmed
                  onEdit={() => setEditTarget(p)}
                  onRemove={p.source_type === "individual" ? () => setRemoveTarget(p) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {addOpen && (
        <AddTextbookModal
          studentProfileId={studentProfileId}
          onClose={() => setAddOpen(false)}
          onSuccess={() => {
            setAddOpen(false);
            reload();
            router.refresh();
          }}
        />
      )}
      {editTarget && (
        <EditProgressModal
          progress={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => {
            setEditTarget(null);
            reload();
          }}
        />
      )}
      <ConfirmDialog
        open={!!removeTarget}
        title="교재 제거"
        description={removeTarget ? `"${removeTarget.textbook_title}" 교재를 이 학생에서 제거할까요?` : undefined}
        confirmLabel={removePending ? "제거 중…" : "제거"}
        disabled={removePending}
        onConfirm={async () => {
          if (!removeTarget) return;
          setRemovePending(true);
          await removeTextbookFromStudent(removeTarget.id);
          setRemovePending(false);
          setRemoveTarget(null);
          reload();
          router.refresh();
        }}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}

function AddTextbookModal({
  studentProfileId,
  onClose,
  onSuccess,
}: {
  studentProfileId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [options, setOptions] = useState<Textbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    listTextbooksNotAssignedToStudent(studentProfileId).then((list) => {
      setOptions(list);
      setLoading(false);
    });
  }, [studentProfileId]);

  const filtered = search.trim()
    ? options.filter(
        (t) =>
          t.title.toLowerCase().includes(search.toLowerCase()) ||
          (t.series && t.series.toLowerCase().includes(search.toLowerCase()))
      )
    : options;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setPending(true);
    setError(null);
    const result = await assignTextbookToStudent(studentProfileId, selectedId);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">교재 배정</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="닫기">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {loading ? (
          <LoadingState label="교재 목록 불러오는 중..." className="py-4" />
        ) : options.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">배정 가능한 교재가 없습니다.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <input
              type="search"
              placeholder="교재명 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400"
            />
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
              required
            >
              <option value="">교재를 선택하세요</option>
              {filtered.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} {t.level ? `(Lv.${t.level})` : ""} — {t.total_units}단원
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
                취소
              </button>
              <button type="submit" disabled={pending} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                {pending ? "배정 중…" : "배정"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function DatePickerField({
  label,
  value,
  onChange,
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  id: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 pr-10"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.showPicker?.()}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
          aria-label="날짜 선택"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function EditProgressModal({
  progress,
  onClose,
  onSuccess,
}: {
  progress: StudentTextbookProgress;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [units, setUnits] = useState(progress.completed_units);
  const [note, setNote] = useState(progress.note ?? "");
  const [assignedDate, setAssignedDate] = useState(toInputDate(progress.assigned_at));
  const [completedDate, setCompletedDate] = useState(toInputDate(progress.completed_at));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pct = progress.total_units > 0 ? Math.round((units / progress.total_units) * 100) : 0;
  const isCompleted = units >= progress.total_units;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);

    const assignedAt = assignedDate ? new Date(assignedDate + "T00:00:00").toISOString() : null;
    const completedAt = isCompleted && completedDate
      ? new Date(completedDate + "T00:00:00").toISOString()
      : isCompleted
        ? new Date().toISOString()
        : null;

    const result = await updateProgress(
      progress.id,
      units,
      note || null,
      assignedAt,
      completedAt
    );
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">진도 수정</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="닫기">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">{progress.textbook_title}</p>
            <p className="text-xs text-slate-500">총 {progress.total_units}단원</p>
          </div>
          <div>
            <label htmlFor="ep-units" className="mb-1 block text-sm font-medium text-slate-700">
              완료 단원 수
            </label>
            <div className="flex items-center gap-3">
              <input
                id="ep-units"
                type="range"
                min={0}
                max={progress.total_units}
                value={units}
                onChange={(e) => setUnits(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-medium text-slate-700 min-w-[4rem] text-right">
                {units}/{progress.total_units} ({pct}%)
              </span>
            </div>
          </div>

          {/* 날짜 수정 */}
          <div className="grid grid-cols-2 gap-3">
            <DatePickerField
              label="배정일"
              value={assignedDate}
              onChange={setAssignedDate}
              id="ep-assigned-date"
            />
            {isCompleted && (
              <DatePickerField
                label="완료일"
                value={completedDate}
                onChange={setCompletedDate}
                id="ep-completed-date"
              />
            )}
          </div>

          <div>
            <label htmlFor="ep-note" className="mb-1 block text-sm font-medium text-slate-700">
              메모
            </label>
            <textarea
              id="ep-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
              rows={2}
              placeholder="진도 관련 메모"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
              취소
            </button>
            <button type="submit" disabled={pending} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
              {pending ? "저장 중…" : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


"use client";

import {
  listStudentProgress,
  listTextbooksNotAssignedToStudent,
  assignTextbookToStudent,
  removeTextbookFromStudent,
  updateProgress,
  type StudentTextbookProgress,
  type Textbook,
} from "../../actions/textbook-actions";
import { TEXTBOOK_CATEGORIES } from "../../actions/textbook-constants";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const STATUS_MAP = {
  not_started: { label: "시작 전", color: "bg-slate-100 text-slate-600" },
  in_progress: { label: "진행 중", color: "bg-blue-100 text-blue-700" },
  completed: { label: "완료", color: "bg-emerald-100 text-emerald-700" },
} as const;

export function StudentTextbookTab({ studentProfileId }: { studentProfileId: string }) {
  const router = useRouter();
  const [progress, setProgress] = useState<StudentTextbookProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StudentTextbookProgress | null>(null);
  const [removeTarget, setRemoveTarget] = useState<StudentTextbookProgress | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listStudentProgress(studentProfileId);
    setProgress(data);
    setLoading(false);
  }, [studentProfileId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && progress.length === 0) {
    return <div className="py-8 text-center text-sm text-slate-500">불러오는 중…</div>;
  }

  return (
    <div className="space-y-4">
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

      {progress.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-slate-500">
          배정된 교재가 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {progress.map((p) => {
            const pct = p.total_units > 0 ? Math.round((p.completed_units / p.total_units) * 100) : 0;
            const st = STATUS_MAP[p.status];
            const catLabel = TEXTBOOK_CATEGORIES.find((c) => c.value === p.textbook_category)?.label ?? p.textbook_category;

            return (
              <div
                key={p.id}
                className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-slate-800 truncate">{p.textbook_title}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>
                      {st.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">{catLabel}</span>
                    {p.textbook_level && <span>Lv. {p.textbook_level}</span>}
                    <span>
                      {p.source_type === "class"
                        ? `반 배정 (${p.source_class_name ?? ""})`
                        : "개별 배정"}
                    </span>
                  </div>
                  {/* 진도 바 */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 100 ? "bg-emerald-500" : "bg-blue-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-600 shrink-0">
                      {p.completed_units}/{p.total_units} ({pct}%)
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditTarget(p)}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    진도 수정
                  </button>
                  {p.source_type === "individual" && (
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(p)}
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                    >
                      제거
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {addOpen && (
        <AddTextbookModal
          studentProfileId={studentProfileId}
          onClose={() => setAddOpen(false)}
          onSuccess={() => {
            setAddOpen(false);
            load();
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
            load();
          }}
        />
      )}
      {removeTarget && (
        <ConfirmRemoveModal
          title={removeTarget.textbook_title}
          onClose={() => setRemoveTarget(null)}
          onConfirm={async () => {
            await removeTextbookFromStudent(removeTarget.id);
            setRemoveTarget(null);
            load();
            router.refresh();
          }}
        />
      )}
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
          <p className="py-4 text-center text-sm text-slate-500">불러오는 중…</p>
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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await updateProgress(progress.id, units, note || null);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onSuccess();
  };

  const pct = progress.total_units > 0 ? Math.round((units / progress.total_units) * 100) : 0;

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

function ConfirmRemoveModal({
  title,
  onClose,
  onConfirm,
}: {
  title: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-800">교재 제거</h3>
        <p className="mt-2 text-sm text-slate-600">
          &quot;{title}&quot; 교재를 이 학생에서 제거할까요?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
            취소
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              await onConfirm();
              setPending(false);
            }}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            {pending ? "제거 중…" : "제거"}
          </button>
        </div>
      </div>
    </div>
  );
}

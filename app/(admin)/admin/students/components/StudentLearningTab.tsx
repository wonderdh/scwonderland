"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listLearningRecords,
  createLearningRecord,
  updateLearningRecord,
  deleteLearningRecord,
} from "../../actions";
import type { LearningRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const CATEGORIES: { value: LearningRecord["category"]; label: string }[] = [
  { value: "test", label: "시험" },
  { value: "assessment", label: "평가" },
  { value: "note", label: "메모" },
  { value: "level_change", label: "레벨 변경" },
];

const CATEGORY_COLORS: Record<string, string> = {
  test: "bg-blue-100 text-blue-700",
  assessment: "bg-purple-100 text-purple-700",
  note: "bg-slate-100 text-slate-700",
  level_change: "bg-amber-100 text-amber-700",
};

function categoryLabel(cat: string) {
  return CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

export function StudentLearningTab({ studentProfileId }: { studentProfileId: string }) {
  const router = useRouter();
  const [records, setRecords] = useState<LearningRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [formCategory, setFormCategory] = useState<string>("note");
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formScore, setFormScore] = useState("");
  const [formMaxScore, setFormMaxScore] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const loadRecords = useCallback(async () => {
    setLoading(true);
    const data = await listLearningRecords(studentProfileId);
    setRecords(data);
    setLoading(false);
  }, [studentProfileId]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const resetForm = () => {
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormCategory("note");
    setFormTitle("");
    setFormContent("");
    setFormScore("");
    setFormMaxScore("");
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const openEdit = (rec: LearningRecord) => {
    setFormDate(rec.record_date);
    setFormCategory(rec.category);
    setFormTitle(rec.title);
    setFormContent(rec.content ?? "");
    setFormScore(rec.score?.toString() ?? "");
    setFormMaxScore(rec.max_score?.toString() ?? "");
    setEditingId(rec.id);
    setShowForm(true);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const payload = {
      record_date: formDate,
      category: formCategory,
      title: formTitle,
      content: formContent || undefined,
      score: formScore ? Number(formScore) : undefined,
      max_score: formMaxScore ? Number(formMaxScore) : undefined,
    };

    const result = editingId
      ? await updateLearningRecord(editingId, payload)
      : await createLearningRecord(studentProfileId, payload);

    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    resetForm();
    router.refresh();
    await loadRecords();
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const result = await deleteLearningRecord(id);
    setDeleting(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    await loadRecords();
  };

  const filtered =
    filterCategory === "all"
      ? records
      : records.filter((r) => r.category === filterCategory);

  if (loading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">불러오는 중…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="min-h-[44px] rounded-lg border border-input px-3 py-2 text-sm bg-background sm:min-h-0"
          >
            <option value="all">전체 ({records.length})</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label} ({records.filter((r) => r.category === c.value).length})
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          onClick={() => { resetForm(); setShowForm(true); }}
          className="min-h-[44px] touch-manipulation sm:min-h-[40px]"
        >
          + 기록 추가
        </Button>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border bg-card p-4 space-y-3 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">
            {editingId ? "기록 수정" : "새 기록 추가"}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">날짜</label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="min-h-[44px] sm:min-h-0"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">카테고리</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-input px-3 py-2 text-sm bg-background sm:min-h-0"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">제목</label>
            <Input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="제목을 입력하세요"
              className="min-h-[44px] sm:min-h-0"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">내용 (선택)</label>
            <Textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="상세 내용"
              rows={3}
            />
          </div>
          {(formCategory === "test" || formCategory === "assessment") && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">점수</label>
                <Input
                  type="number"
                  value={formScore}
                  onChange={(e) => setFormScore(e.target.value)}
                  placeholder="0"
                  className="min-h-[44px] sm:min-h-0"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">만점</label>
                <Input
                  type="number"
                  value={formMaxScore}
                  onChange={(e) => setFormMaxScore(e.target.value)}
                  placeholder="100"
                  className="min-h-[44px] sm:min-h-0"
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetForm} className="min-h-[44px] sm:min-h-[40px]">
              취소
            </Button>
            <Button onClick={handleSave} disabled={saving} className="min-h-[44px] sm:min-h-[40px]">
              {saving ? "저장 중…" : editingId ? "수정" : "추가"}
            </Button>
          </div>
        </div>
      )}

      {/* Records List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">학습 기록이 없습니다.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((rec) => (
            <li key={rec.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[rec.category] ?? "bg-slate-100 text-slate-700"}`}>
                      {categoryLabel(rec.category)}
                    </span>
                    <span className="text-xs text-muted-foreground">{rec.record_date}</span>
                  </div>
                  <h4 className="text-sm font-medium text-foreground">{rec.title}</h4>
                  {rec.content && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{rec.content}</p>
                  )}
                  {rec.score != null && (
                    <p className="mt-1 text-sm font-medium text-blue-600">
                      {rec.score}{rec.max_score != null ? ` / ${rec.max_score}` : ""}점
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(rec)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(rec.id)}
                    disabled={deleting === rec.id}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                  >
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

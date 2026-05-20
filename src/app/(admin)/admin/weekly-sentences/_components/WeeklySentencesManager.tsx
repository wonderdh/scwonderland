"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Upload } from "lucide-react";
import { Modal } from "@/components/overlays/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/feedback/LoadingState";
import { ConfirmDialog } from "@/components/overlays/ConfirmDialog";
import { FormGroup } from "@/components/forms/FormGroup";
import { PageHeader } from "@/components/navigation/PageHeader";
import {
  upsertWeeklySentence,
  deleteWeeklySentence,
  bulkImportWeeklySentences,
  updateWeeklySentenceConfig,
} from "@/app/(admin)/admin/actions";
import { WEEKLY_SENTENCE_LEVELS } from "@/lib/constants/weekly-sentence";
import { computeAutoWeekNumber } from "@/lib/utils/weekly-sentence-week";
import type { WeeklySentence, WeeklySentenceConfig } from "@/lib/types";

type Props = {
  initialSentences: WeeklySentence[];
  initialConfig: WeeklySentenceConfig | null;
};

export function WeeklySentencesManager({
  initialSentences,
  initialConfig,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sentences, setSentences] = useState(initialSentences);
  const [config, setConfig] = useState<WeeklySentenceConfig | null>(initialConfig);

  // 편집 모달 상태
  const [editTarget, setEditTarget] = useState<{
    weekNumber: number;
    level: number;
    existing?: WeeklySentence;
  } | null>(null);
  const [editEnglish, setEditEnglish] = useState("");
  const [editKorean, setEditKorean] = useState("");
  const [editExample, setEditExample] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [saving, setSaving] = useState(false);

  // 검색/필터
  const [searchWeek, setSearchWeek] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // 주차 그룹핑
  const weekMap = useMemo(() => {
    const map = new Map<number, Map<number, WeeklySentence>>();
    for (const s of sentences) {
      let levelMap = map.get(s.week_number);
      if (!levelMap) {
        levelMap = new Map();
        map.set(s.week_number, levelMap);
      }
      levelMap.set(s.level, s);
    }
    return map;
  }, [sentences]);

  const autoWeek = computeAutoWeekNumber(
    config?.auto_base_week ?? 1,
    config?.auto_base_sunday ?? "2026-04-12",
  );
  const activeWeek =
    config?.mode === "manual" && config?.manual_week
      ? config.manual_week
      : autoWeek;

  // 표시할 주차 목록
  const weeks = Array.from({ length: 48 }, (_, i) => i + 1).filter((w) => {
    if (!searchWeek) return true;
    return w === Number(searchWeek);
  });

  function openEdit(weekNumber: number, level: number) {
    const existing = weekMap.get(weekNumber)?.get(level);
    setEditTarget({ weekNumber, level, existing });
    setEditEnglish(existing?.english ?? "");
    setEditKorean(existing?.korean ?? "");
    setEditExample(existing?.example ?? "");
    setEditAnswer(existing?.answer ?? "");
  }

  async function handleSave() {
    if (!editTarget) return;
    setSaving(true);
    const result = await upsertWeeklySentence(
      editTarget.weekNumber,
      editTarget.level,
      editEnglish,
      editKorean,
      editExample,
      editAnswer,
    );
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("저장되었습니다.");
    setEditTarget(null);
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string) {
    const result = await deleteWeeklySentence(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("삭제되었습니다.");
    setSentences((prev) => prev.filter((s) => s.id !== id));
    setDeleteTargetId(null);
    setEditTarget(null);
    startTransition(() => router.refresh());
  }

  async function handleBulkUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    setSaving(true);
    const result = await bulkImportWeeklySentences(formData);
    setSaving(false);
    e.target.value = "";
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`${result.count}개 문장이 업로드되었습니다.`);
    startTransition(() => router.refresh());
  }

  async function handleConfigChange(
    mode: "auto" | "manual",
    manualWeek?: number,
    autoBaseWeek?: number,
  ) {
    const result = await updateWeeklySentenceConfig(mode, manualWeek, autoBaseWeek);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setConfig((prev) =>
      prev
        ? {
            ...prev,
            mode,
            manual_week: mode === "manual" ? (manualWeek ?? null) : null,
            auto_base_week: autoBaseWeek ?? prev.auto_base_week,
          }
        : null,
    );
    toast.success(
      autoBaseWeek
        ? `현재 주차를 Week ${autoBaseWeek}로 설정했습니다.`
        : mode === "auto"
          ? "자동 모드로 전환되었습니다."
          : `Week ${manualWeek}로 고정되었습니다.`,
    );
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="주간 문장 관리"
        description="48주 × 4레벨 주간 문장을 등록하고 현재 주차를 조정하세요."
        actions={
          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-base text-slate-700 hover:bg-slate-50">
            <Upload className="h-5 w-5" aria-hidden="true" />
            Excel 업로드
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleBulkUpload}
              disabled={saving}
            />
          </label>
        }
      />

      {/* 현재 주차 설정 패널 */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-700">주차 설정</h2>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-base">
            <span className="text-slate-500">현재 주차:</span>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">
              Week {activeWeek}
            </span>
            {config?.mode === "manual" && (
              <span className="text-sm text-amber-600">(수동 고정)</span>
            )}
            {config?.mode !== "manual" && (
              <span className="text-sm text-blue-500">(자동 +1/주)</span>
            )}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* 현재 주차 직접 설정 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">현재 주차:</span>
              <input
                type="number"
                min={1}
                max={48}
                defaultValue={autoWeek}
                className="h-11 w-20 rounded-lg border border-slate-200 px-2 text-center text-base"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = Number((e.target as HTMLInputElement).value);
                    if (v >= 1 && v <= 48) handleConfigChange("auto", undefined, v);
                  }
                }}
                id="week-base-input"
              />
              <Button
                variant="outline"
                onClick={() => {
                  const el = document.getElementById("week-base-input") as HTMLInputElement;
                  const v = Number(el?.value);
                  if (v >= 1 && v <= 48) handleConfigChange("auto", undefined, v);
                }}
              >
                설정
              </Button>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            {/* 수동 고정 / 자동 전환 */}
            {config?.mode === "manual" ? (
              <Button
                variant="outline"
                onClick={() => handleConfigChange("auto")}
              >
                자동으로 전환
              </Button>
            ) : (
              <select
                value=""
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v) handleConfigChange("manual", v);
                }}
                className="h-11 rounded-lg border border-slate-200 px-3 text-base text-slate-700"
              >
                <option value="">수동 고정...</option>
                {Array.from({ length: 48 }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={w}>
                    Week {w}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* 검색 */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="주차 번호 검색 (1~48)"
          type="number"
          min={1}
          max={52}
          value={searchWeek}
          onChange={(e) => setSearchWeek(e.target.value)}
          className="w-44 h-11 text-base"
        />
        {searchWeek && (
          <Button variant="ghost" onClick={() => setSearchWeek("")}>
            초기화
          </Button>
        )}
        <span className="text-sm text-slate-500">
          총 {sentences.length}개 문장
        </span>
      </div>

      {/* 주차별 테이블 */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="px-3 py-3 text-left text-lg font-semibold text-slate-700 w-24">
                Week
              </th>
              {WEEKLY_SENTENCE_LEVELS.map((lv) => (
                <th
                  key={lv.level}
                  className="px-3 py-3 text-left text-lg font-semibold text-slate-700 min-w-[220px]"
                >
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold ${lv.color}`}>
                    {lv.label} ({lv.subLabel})
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => {
              const isActive = w === activeWeek;
              return (
                <tr
                  key={w}
                  className={`border-b transition-colors ${
                    isActive
                      ? "bg-orange-50/50"
                      : "hover:bg-slate-50/50"
                  }`}
                >
                  <td className="px-3 py-3">
                    <span
                      className={`text-base font-semibold ${
                        isActive ? "text-orange-700" : "text-slate-600"
                      }`}
                    >
                      {w}
                    </span>
                    {isActive && (
                      <span className="ml-1 text-sm text-orange-500">
                        *
                      </span>
                    )}
                  </td>
                  {WEEKLY_SENTENCE_LEVELS.map((lv) => {
                    const item = weekMap.get(w)?.get(lv.level);
                    return (
                      <td key={lv.level} className="px-3 py-2 min-w-[220px]">
                        {item ? (
                          <button
                            type="button"
                            onClick={() => openEdit(w, lv.level)}
                            className="group flex w-full items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-50"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-800 group-hover:text-blue-600">
                                {item.english}
                              </p>
                              <p className="truncate text-sm text-slate-500">
                                {item.answer || item.korean}
                              </p>
                            </div>
                            <Pencil
                              className="h-4 w-4 shrink-0 text-slate-300 opacity-0 group-hover:opacity-100"
                              aria-hidden="true"
                            />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openEdit(w, lv.level)}
                            className="text-sm text-slate-400 hover:text-blue-500"
                          >
                            + 추가
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 편집 모달 */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)}>
        {editTarget && (
          <div className="p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-800">
              Week {editTarget.weekNumber} ·{" "}
              {WEEKLY_SENTENCE_LEVELS.find((l) => l.level === editTarget.level)
                ?.label ?? `Level ${editTarget.level}`}
            </h3>
            <div className="space-y-4">
              <FormGroup label={editTarget.level === 1 ? "질문 (Q)" : "영어 문장"} required>
                <Input
                  value={editEnglish}
                  onChange={(e) => setEditEnglish(e.target.value)}
                  placeholder={editTarget.level === 1 ? "What season is it?" : "Hello!"}
                  className="h-11 text-base"
                />
              </FormGroup>
              {editTarget.level === 1 && (
                <FormGroup label="대답 (A)">
                  <Input
                    value={editAnswer}
                    onChange={(e) => setEditAnswer(e.target.value)}
                    placeholder="It's winter in January."
                    className="h-11 text-base"
                  />
                </FormGroup>
              )}
              {editTarget.level !== 1 && (
                <FormGroup label="한글 뜻">
                  <Input
                    value={editKorean}
                    onChange={(e) => setEditKorean(e.target.value)}
                    placeholder="안녕!"
                    className="h-11 text-base"
                  />
                </FormGroup>
              )}
              <FormGroup label="활용 예시" help="선택 입력 — 학생에게 보여줄 추가 예문">
                <textarea
                  value={editExample}
                  onChange={(e) => setEditExample(e.target.value)}
                  placeholder="Hello! I'm happy to see you."
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </FormGroup>
            </div>
            <div className="mt-5 flex items-center justify-between">
              {editTarget.existing ? (
                <button
                  type="button"
                  onClick={() => setDeleteTargetId(editTarget.existing!.id)}
                  className="text-sm font-medium text-red-600 hover:text-red-700"
                >
                  삭제
                </button>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditTarget(null)}
                >
                  취소
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "저장 중…" : "저장"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTargetId !== null}
        title="주간 문장 삭제"
        description="이 문장을 삭제하시겠습니까?"
        danger
        impactList={["학생에게 더 이상 이 문장이 노출되지 않습니다."]}
        onConfirm={() => deleteTargetId && handleDelete(deleteTargetId)}
        onCancel={() => setDeleteTargetId(null)}
      />

      {(pending || saving) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-white/60">
          <LoadingState label={saving ? "저장 중" : "갱신 중"} />
        </div>
      )}
    </div>
  );
}

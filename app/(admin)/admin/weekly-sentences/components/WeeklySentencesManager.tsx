"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/Spinner";
import {
  upsertWeeklySentence,
  deleteWeeklySentence,
  bulkImportWeeklySentences,
  updateWeeklySentenceConfig,
} from "@/app/(admin)/admin/actions";
import { WEEKLY_SENTENCE_LEVELS } from "@/lib/weekly-sentence-levels";
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
  const [config, setConfig] = useState(initialConfig);

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
    if (!window.confirm("이 문장을 삭제하시겠습니까?")) return;
    const result = await deleteWeeklySentence(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("삭제되었습니다.");
    setSentences((prev) => prev.filter((s) => s.id !== id));
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
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">주간 문장 관리</h1>
        <div className="flex items-center gap-2">
          <label className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            Excel 업로드
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleBulkUpload}
              disabled={saving}
            />
          </label>
        </div>
      </div>

      {/* 현재 주차 설정 패널 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-600">주차 설정</h2>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">현재 주차:</span>
            <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-700">
              Week {activeWeek}
            </span>
            {config?.mode === "manual" && (
              <span className="text-xs text-amber-600">(수동 고정)</span>
            )}
            {config?.mode !== "manual" && (
              <span className="text-xs text-blue-500">(자동 +1/주)</span>
            )}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* 현재 주차 직접 설정 */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">현재 주차:</span>
              <input
                type="number"
                min={1}
                max={48}
                defaultValue={autoWeek}
                className="h-8 w-16 rounded-lg border border-slate-200 px-2 text-center text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = Number((e.target as HTMLInputElement).value);
                    if (v >= 1 && v <= 48) handleConfigChange("auto", undefined, v);
                  }
                }}
                id="week-base-input"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
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
                size="sm"
                variant="outline"
                className="h-8 text-xs"
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
                className="h-8 rounded-lg border border-slate-200 px-2 text-xs text-slate-700"
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
          className="w-40"
        />
        {searchWeek && (
          <Button size="sm" variant="ghost" onClick={() => setSearchWeek("")}>
            초기화
          </Button>
        )}
        <span className="text-xs text-slate-400">
          총 {sentences.length}개 문장
        </span>
      </div>

      {/* 주차별 테이블 */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 w-20">
                Week
              </th>
              {WEEKLY_SENTENCE_LEVELS.map((lv) => (
                <th
                  key={lv.level}
                  className="px-3 py-2.5 text-left text-xs font-medium text-slate-500"
                >
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${lv.color}`}>
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
                  <td className="px-3 py-2.5">
                    <span
                      className={`text-xs font-semibold ${
                        isActive ? "text-orange-700" : "text-slate-600"
                      }`}
                    >
                      {w}
                    </span>
                    {isActive && (
                      <span className="ml-1 text-[10px] text-orange-500">
                        *
                      </span>
                    )}
                  </td>
                  {WEEKLY_SENTENCE_LEVELS.map((lv) => {
                    const item = weekMap.get(w)?.get(lv.level);
                    return (
                      <td key={lv.level} className="px-3 py-2.5">
                        {item ? (
                          <button
                            type="button"
                            onClick={() => openEdit(w, lv.level)}
                            className="group w-full text-left"
                          >
                            <p className="truncate text-xs font-medium text-slate-800 group-hover:text-blue-600">
                              {item.english}
                            </p>
                            <p className="truncate text-[10px] text-slate-400">
                              {item.answer || item.korean}
                            </p>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openEdit(w, lv.level)}
                            className="text-xs text-slate-300 hover:text-blue-500"
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
      {editTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setEditTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-sm font-semibold text-slate-800">
              Week {editTarget.weekNumber} ·{" "}
              {WEEKLY_SENTENCE_LEVELS.find((l) => l.level === editTarget.level)
                ?.label ?? `Level ${editTarget.level}`}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  {editTarget.level === 1 ? "질문 (Q)" : "영어 문장"}
                </label>
                <Input
                  value={editEnglish}
                  onChange={(e) => setEditEnglish(e.target.value)}
                  placeholder={editTarget.level === 1 ? "What season is it?" : "Hello!"}
                />
              </div>
              {editTarget.level === 1 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    대답 (A)
                  </label>
                  <Input
                    value={editAnswer}
                    onChange={(e) => setEditAnswer(e.target.value)}
                    placeholder="It's winter in January."
                  />
                </div>
              )}
              {editTarget.level !== 1 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    한글 뜻
                  </label>
                  <Input
                    value={editKorean}
                    onChange={(e) => setEditKorean(e.target.value)}
                    placeholder="안녕!"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  활용 예시 (선택)
                </label>
                <textarea
                  value={editExample}
                  onChange={(e) => setEditExample(e.target.value)}
                  placeholder="Hello! I'm happy to see you."
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              {editTarget.existing ? (
                <button
                  type="button"
                  onClick={() => {
                    handleDelete(editTarget.existing!.id);
                    setEditTarget(null);
                  }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  삭제
                </button>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditTarget(null)}
                >
                  취소
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving && <Spinner size="sm" />}
                  저장
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(pending || saving) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-white/60">
          <Spinner size="lg" />
        </div>
      )}
    </div>
  );
}

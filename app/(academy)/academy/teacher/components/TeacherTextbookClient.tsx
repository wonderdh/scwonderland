"use client";

import { useCallback, useEffect, useState } from "react";
import type { TeacherClassWithStudents, TeacherClassTextbook } from "@/lib/types";
import { getClassTextbooks } from "../../actions";

const CATEGORY_LABELS: Record<string, string> = {
  general: "일반",
  phonics: "파닉스",
  reading: "읽기",
  grammar: "문법",
  speaking: "말하기",
  writing: "쓰기",
  vocabulary: "어휘",
};

export function TeacherTextbookClient({
  classes,
  initialClassId,
  initialTextbooks,
}: {
  classes: TeacherClassWithStudents[];
  initialClassId: string | null;
  initialTextbooks: TeacherClassTextbook[];
}) {
  const [selectedClassId, setSelectedClassId] = useState(
    initialClassId ?? classes[0]?.id ?? ""
  );
  const [textbooks, setTextbooks] = useState<TeacherClassTextbook[]>(initialTextbooks);
  const [loading, setLoading] = useState(false);

  const loadTextbooks = useCallback(async () => {
    if (!selectedClassId) return;
    setLoading(true);
    const data = await getClassTextbooks(selectedClassId);
    setTextbooks(data);
    setLoading(false);
  }, [selectedClassId]);

  // 반이 변경될 때만 로드 (초기값은 서버에서 받음)
  useEffect(() => {
    if (selectedClassId !== initialClassId) {
      loadTextbooks();
    }
  }, [selectedClassId, initialClassId, loadTextbooks]);

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  if (classes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">
        <p className="text-sm text-slate-500">담당 반이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-slate-800">교재 현황</h1>
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="min-h-[44px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.students.length}명)
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-400">불러오는 중…</p>
        </div>
      ) : textbooks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">
          <p className="text-sm text-slate-500">
            {selectedClass?.name ?? "이 반"}에 배정된 교재가 없습니다.
          </p>
          <p className="mt-1 text-xs text-slate-400">관리자에게 교재 배정을 요청하세요.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {textbooks.map((t) => (
            <div
              key={t.id}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-800">{t.textbook_title}</h3>
                  {t.textbook_series && (
                    <p className="text-sm text-slate-500">{t.textbook_series}</p>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {CATEGORY_LABELS[t.textbook_category] ?? t.textbook_category}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-4 text-sm text-slate-500">
                {t.textbook_level && (
                  <span>레벨: {t.textbook_level}</span>
                )}
                <span>총 {t.total_units}단원</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

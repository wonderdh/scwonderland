"use client";

import type { UserWithProfile } from "../actions";
import type { updateStudentProfile } from "../actions";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function StudentInfoCard({
  user,
  onUpdate,
}: {
  user: UserWithProfile;
  onUpdate: typeof updateStudentProfile;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [koreanName, setKoreanName] = useState(user.korean_name ?? user.first_name ?? "");
  const [englishName, setEnglishName] = useState(user.english_name ?? user.last_name ?? "");

  const handleStartEdit = () => {
    setKoreanName(user.korean_name ?? user.first_name ?? "");
    setEnglishName(user.english_name ?? user.last_name ?? "");
    setError(null);
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setError(null);
    setKoreanName(user.korean_name ?? user.first_name ?? "");
    setEnglishName(user.english_name ?? user.last_name ?? "");
  };

  const handleSave = async () => {
    if (!koreanName.trim()) {
      setError("한글 이름을 입력해 주세요.");
      return;
    }
    setPending(true);
    setError(null);
    const form = new FormData();
    form.set("id", user.id);
    form.set("korean_name", koreanName.trim());
    form.set("english_name", englishName.trim());
    const result = await onUpdate(form);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  };

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-slate-800">학생 정보</h2>
        {!editing ? (
          <button
            type="button"
            onClick={handleStartEdit}
            className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
          >
            수정
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="px-3 py-1.5 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg disabled:opacity-50"
            >
              {pending ? "저장 중…" : "저장"}
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="mb-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      <dl className="divide-y divide-slate-100">
        <div className="py-3 flex gap-4 items-center">
          <dt className="w-28 shrink-0 text-slate-500 text-sm">한글 이름</dt>
          <dd className="text-slate-800 flex-1 min-w-0">
            {editing ? (
              <input
                type="text"
                value={koreanName}
                onChange={(e) => setKoreanName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800"
                placeholder="한글 이름"
              />
            ) : (
              (user.korean_name ?? user.first_name) || "—"
            )}
          </dd>
        </div>
        <div className="py-3 flex gap-4 items-center">
          <dt className="w-28 shrink-0 text-slate-500 text-sm">영어 이름</dt>
          <dd className="text-slate-800 flex-1 min-w-0">
            {editing ? (
              <input
                type="text"
                value={englishName}
                onChange={(e) => setEnglishName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800"
                placeholder="영어 이름"
              />
            ) : (
              (user.english_name ?? user.last_name) || "—"
            )}
          </dd>
        </div>
        <div className="py-3 flex gap-4">
          <dt className="w-28 shrink-0 text-slate-500 text-sm">학번</dt>
          <dd className="text-slate-800 font-mono">{user.student_number ?? "—"}</dd>
        </div>
        <div className="py-3 flex gap-4">
          <dt className="w-28 shrink-0 text-slate-500 text-sm">이메일</dt>
          <dd className="text-slate-800 break-all">{user.email || "—"}</dd>
        </div>
      </dl>
    </div>
  );
}

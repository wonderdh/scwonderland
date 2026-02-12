"use client";

import { useState } from "react";
import type { UserWithProfile } from "../actions";

type UserRowProps = {
  user: UserWithProfile;
  variant: "student" | "teacher";
  onUpdate: (formData: FormData) => Promise<{ error?: string }>;
  onDelete: (formData: FormData) => Promise<{ error?: string }>;
};

export function UserRow({ user, variant, onUpdate, onDelete }: UserRowProps) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("id", user.id);
    const result = await onUpdate(formData);
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setEditing(false);
  }

  async function handleDelete(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!confirm("정말 삭제할까요?")) return;
    const formData = new FormData(e.currentTarget);
    await onDelete(formData);
  }

  const displayName =
    variant === "student"
      ? [user.korean_name, user.english_name].filter(Boolean).join(" / ") || user.first_name || "—"
      : user.name || user.first_name || "—";
  const subLine =
    variant === "student"
      ? user.student_number
        ? `학번 ${user.student_number}`
        : user.email
      : user.teacher_number
        ? `교번 ${user.teacher_number} · ${user.email}`
        : user.email;

  return (
    <li className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50">
      <div className="flex-1 min-w-0">
        {editing ? (
          <form
            onSubmit={handleUpdate}
            className="flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="id" value={user.id} />
            <span className="text-slate-500 text-sm w-full">{user.email}</span>
            {variant === "student" ? (
              <>
                <input
                  type="text"
                  name="korean_name"
                  defaultValue={user.korean_name ?? user.first_name ?? ""}
                  placeholder="한글 이름 *"
                  required
                  className="px-2 py-1 border border-slate-300 rounded text-sm w-28"
                />
                <input
                  type="text"
                  name="english_name"
                  defaultValue={user.english_name ?? user.last_name ?? ""}
                  placeholder="영어 이름"
                  className="px-2 py-1 border border-slate-300 rounded text-sm w-28"
                />
              </>
            ) : (
              <input
                type="text"
                name="name"
                defaultValue={user.name ?? user.first_name ?? ""}
                placeholder="이름 *"
                required
                className="px-2 py-1 border border-slate-300 rounded text-sm w-32"
              />
            )}
            <button
              type="submit"
              className="px-2 py-1 bg-slate-700 text-white text-xs rounded hover:bg-slate-600"
            >
              저장
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-2 py-1 text-slate-500 text-xs"
            >
              취소
            </button>
          </form>
        ) : (
          <>
            <p className="font-medium text-slate-800 truncate">{displayName}</p>
            <p className="text-sm text-slate-500 truncate">{subLine}</p>
          </>
        )}
        {error && (
          <p className="text-xs text-red-600 mt-1">{error}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!editing && (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              수정
            </button>
            <form className="inline" onSubmit={handleDelete}>
              <input type="hidden" name="id" value={user.id} />
              <button
                type="submit"
                className="px-3 py-1.5 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
              >
                삭제
              </button>
            </form>
          </>
        )}
      </div>
    </li>
  );
}

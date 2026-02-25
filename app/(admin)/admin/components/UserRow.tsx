"use client";

import { useState } from "react";
import type { UserWithProfile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <li className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50">
      <div className="flex-1 min-w-0">
        {editing ? (
          <form
            onSubmit={handleUpdate}
            className="flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="id" value={user.id} />
            <span className="text-muted-foreground text-sm w-full">{user.email}</span>
            {variant === "student" ? (
              <>
                <Input
                  type="text"
                  name="korean_name"
                  defaultValue={user.korean_name ?? user.first_name ?? ""}
                  placeholder="한글 이름 *"
                  required
                  className="h-8 w-28 text-sm"
                />
                <Input
                  type="text"
                  name="english_name"
                  defaultValue={user.english_name ?? user.last_name ?? ""}
                  placeholder="영어 이름"
                  className="h-8 w-28 text-sm"
                />
              </>
            ) : (
              <Input
                type="text"
                name="name"
                defaultValue={user.name ?? user.first_name ?? ""}
                placeholder="이름 *"
                required
                className="h-8 w-32 text-sm"
              />
            )}
            <Button type="submit" size="sm" variant="default" className="h-7 text-xs">
              저장
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setEditing(false)}
            >
              취소
            </Button>
          </form>
        ) : (
          <>
            <p className="font-medium text-foreground truncate">{displayName}</p>
            <p className="text-sm text-muted-foreground truncate">{subLine}</p>
          </>
        )}
        {error && (
          <p className="text-xs text-destructive mt-1">{error}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!editing && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setEditing(true)}
            >
              수정
            </Button>
            <form className="inline" onSubmit={handleDelete}>
              <input type="hidden" name="id" value={user.id} />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                삭제
              </Button>
            </form>
          </>
        )}
      </div>
    </li>
  );
}

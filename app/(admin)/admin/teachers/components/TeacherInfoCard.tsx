"use client";

import type { UserWithProfile } from "@/lib/types";
import type { updateTeacherProfile } from "../../actions";
import { resetUserPassword } from "../../actions";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export function TeacherInfoCard({
  user,
  onUpdate,
}: {
  user: UserWithProfile;
  onUpdate: typeof updateTeacherProfile;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(user.name ?? user.first_name ?? "");
  const [showPwReset, setShowPwReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [pwPending, setPwPending] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const handleStartEdit = () => {
    setName(user.name ?? user.first_name ?? "");
    setError(null);
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setError(null);
    setName(user.name ?? user.first_name ?? "");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("이름을 입력해 주세요.");
      return;
    }
    setPending(true);
    setError(null);
    const form = new FormData();
    form.set("id", user.id);
    form.set("name", name.trim());
    const result = await onUpdate(form);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      setPwMessage({ type: "error", text: "새 비밀번호를 입력해 주세요." });
      return;
    }
    if (newPassword.length < 6) {
      setPwMessage({ type: "error", text: "비밀번호는 최소 6자 이상이어야 합니다." });
      return;
    }
    setPwPending(true);
    setPwMessage(null);
    const result = await resetUserPassword(user.id, newPassword);
    setPwPending(false);
    if (result?.error) {
      setPwMessage({ type: "error", text: result.error });
      return;
    }
    setPwMessage({ type: "success", text: "비밀번호가 변경되었습니다." });
    setNewPassword("");
    setTimeout(() => {
      setShowPwReset(false);
      setPwMessage(null);
    }, 2000);
  };

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-foreground">선생 정보</h2>
        {!editing ? (
          <Button variant="outline" size="sm" onClick={handleStartEdit}>
            수정
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              취소
            </Button>
            <Button size="sm" onClick={handleSave} disabled={pending}>
              {pending ? "저장 중…" : "저장"}
            </Button>
          </div>
        )}
      </div>

      {error && (
        <p className="mb-3 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
      )}

      <dl className="divide-y divide-border">
        <div className="py-3 flex gap-4 items-center">
          <dt className="w-28 shrink-0 text-muted-foreground text-sm">이름</dt>
          <dd className="text-foreground flex-1 min-w-0">
            {editing ? (
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름"
              />
            ) : (
              (user.name ?? user.first_name) || "—"
            )}
          </dd>
        </div>
        <div className="py-3 flex gap-4">
          <dt className="w-28 shrink-0 text-muted-foreground text-sm">교번</dt>
          <dd className="text-foreground font-mono">{user.teacher_number ?? "—"}</dd>
        </div>
        <div className="py-3 flex gap-4">
          <dt className="w-28 shrink-0 text-muted-foreground text-sm">아이디</dt>
          <dd className="text-foreground font-mono">{user.email?.split("@")[0] || "—"}</dd>
        </div>
        <div className="py-3 flex gap-4">
          <dt className="w-28 shrink-0 text-muted-foreground text-sm">이메일</dt>
          <dd className="text-foreground break-all">{user.email || "—"}</dd>
        </div>
      </dl>

      <Separator className="my-4" />

      <div>
        {!showPwReset ? (
          <Button
            variant="outline"
            size="sm"
            className="text-amber-700 border-amber-200 hover:bg-amber-50"
            onClick={() => { setShowPwReset(true); setPwMessage(null); setNewPassword(""); }}
          >
            비밀번호 재설정
          </Button>
        ) : (
          <div className="space-y-3">
            <Label>새 비밀번호</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="새 비밀번호 (6자 이상)"
                className="flex-1"
              />
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-500 text-white shrink-0"
                onClick={handleResetPassword}
                disabled={pwPending}
              >
                {pwPending ? "변경 중…" : "변경"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => { setShowPwReset(false); setPwMessage(null); }}
              >
                취소
              </Button>
            </div>
            {pwMessage && (
              <p className={`text-sm px-3 py-2 rounded-lg ${
                pwMessage.type === "error"
                  ? "text-destructive bg-destructive/10"
                  : "text-emerald-600 bg-emerald-50"
              }`}>
                {pwMessage.text}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

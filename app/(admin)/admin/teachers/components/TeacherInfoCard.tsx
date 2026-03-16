"use client";

import type { UserWithProfile } from "@/lib/types";
import type { updateTeacherProfile } from "../../actions";
import { resetUserPassword, getTeacherAssignmentCounts } from "../../actions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export function TeacherInfoCard({
  user,
  onUpdate,
  onDelete,
}: {
  user: UserWithProfile;
  onUpdate: typeof updateTeacherProfile;
  onDelete: (formData: FormData) => Promise<{ error?: string }>;
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
  const [delPending, setDelPending] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{
    classCount: number;
    scheduleCount: number;
  } | null>(null);
  const [deleteModalLoading, setDeleteModalLoading] = useState(false);

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
    setSaveMessage({ type: "success", text: "저장되었습니다." });
    setTimeout(() => setSaveMessage(null), 3000);
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

  const handleDelete = async () => {
    setDeleteModalLoading(true);
    const counts = await getTeacherAssignmentCounts(user.id);
    setDeleteModalLoading(false);
    setDeleteModal(counts);
  };

  const handleDeleteConfirm = async () => {
    setDelPending(true);
    const form = new FormData();
    form.set("id", user.id);
    const result = await onDelete(form);
    setDelPending(false);
    setDeleteModal(null);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    setSaveMessage({ type: "success", text: "휴지통으로 이동되었습니다." });
    setTimeout(() => {
      router.push("/admin/teachers");
    }, 1500);
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
      {saveMessage && (
        <p className={`mb-3 text-sm px-3 py-2 rounded-lg ${
          saveMessage.type === "success"
            ? "text-emerald-700 bg-emerald-50"
            : "text-destructive bg-destructive/10"
        }`}>
          {saveMessage.text}
        </p>
      )}

      <dl className="divide-y divide-border">
        <div className="py-3 flex gap-4">
          <dt className="w-28 shrink-0 text-muted-foreground text-sm">아이디</dt>
          <dd className="text-foreground font-mono">{user.email?.split("@")[0] || "—"}</dd>
        </div>
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
      </dl>

      <Separator className="my-4" />

      <div className="flex items-center gap-3">
        {!showPwReset ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="text-amber-700 border-amber-200 hover:bg-amber-50"
              onClick={() => { setShowPwReset(true); setPwMessage(null); setNewPassword(""); }}
            >
              비밀번호 재설정
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={handleDelete}
              disabled={delPending || deleteModalLoading}
            >
              {deleteModalLoading ? "확인 중…" : delPending ? "삭제 중…" : "삭제"}
            </Button>
          </>
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

      <ConfirmDialog
        open={!!deleteModal}
        title="교사 삭제"
        description={deleteModal ? (() => {
          const name = user.name ?? user.first_name ?? "이 선생님";
          const lines: string[] = [`${name} 선생님의 배정 현황:`];
          if (deleteModal.classCount > 0) lines.push(`• 반 담임 ${deleteModal.classCount}개`);
          if (deleteModal.scheduleCount > 0) lines.push(`• 수업 배정 ${deleteModal.scheduleCount}건`);
          if (deleteModal.classCount === 0 && deleteModal.scheduleCount === 0) {
            lines.push("• 배정된 반/수업 없음");
          }
          lines.push("삭제 시 모든 배정이 해제됩니다. 계속하시겠습니까?");
          return lines.join("\n");
        })() : undefined}
        confirmLabel={delPending ? "삭제 중…" : "삭제"}
        disabled={delPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModal(null)}
      />
    </div>
  );
}

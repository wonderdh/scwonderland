"use client";

import type { UserWithProfile } from "@/lib/types";
import type { updateStudentProfile } from "../../actions";
import { resetUserPassword } from "../../actions";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export function StudentInfoCard({
  user,
  onUpdate,
  onDelete,
}: {
  user: UserWithProfile;
  onUpdate: typeof updateStudentProfile;
  onDelete: (formData: FormData) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [koreanName, setKoreanName] = useState(user.korean_name ?? user.first_name ?? "");
  const [englishName, setEnglishName] = useState(user.english_name ?? user.last_name ?? "");
  const [age, setAge] = useState(user.age?.toString() ?? "");
  const [showPwReset, setShowPwReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [pwPending, setPwPending] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [delPending, setDelPending] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState(false);

  const handleStartEdit = () => {
    setKoreanName(user.korean_name ?? user.first_name ?? "");
    setEnglishName(user.english_name ?? user.last_name ?? "");
    setAge(user.age?.toString() ?? "");
    setError(null);
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setError(null);
    setKoreanName(user.korean_name ?? user.first_name ?? "");
    setEnglishName(user.english_name ?? user.last_name ?? "");
    setAge(user.age?.toString() ?? "");
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
    form.set("age", age);
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

  const handleDelete = () => {
    setDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    setDelPending(true);
    const form = new FormData();
    form.set("id", user.id);
    const result = await onDelete(form);
    setDelPending(false);
    setDeleteModal(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSaveMessage({ type: "success", text: "휴지통으로 이동되었습니다." });
    setTimeout(() => {
      router.push("/admin/students");
      router.refresh();
    }, 1500);
  };

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-foreground">학생 정보</h2>
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
          <dt className="w-28 shrink-0 text-muted-foreground text-sm">한글 이름</dt>
          <dd className="text-foreground flex-1 min-w-0">
            {editing ? (
              <Input
                type="text"
                value={koreanName}
                onChange={(e) => setKoreanName(e.target.value)}
                placeholder="한글 이름"
              />
            ) : (
              (user.korean_name ?? user.first_name) || "—"
            )}
          </dd>
        </div>
        <div className="py-3 flex gap-4 items-center">
          <dt className="w-28 shrink-0 text-muted-foreground text-sm">영어 이름</dt>
          <dd className="text-foreground flex-1 min-w-0">
            {editing ? (
              <Input
                type="text"
                value={englishName}
                onChange={(e) => setEnglishName(e.target.value)}
                placeholder="영어 이름"
              />
            ) : (
              (user.english_name ?? user.last_name) || "—"
            )}
          </dd>
        </div>
        <div className="py-3 flex gap-4 items-center">
          <dt className="w-28 shrink-0 text-muted-foreground text-sm">나이</dt>
          <dd className="text-foreground flex-1 min-w-0">
            {editing ? (
              <Input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                min={3}
                max={20}
                placeholder="나이"
              />
            ) : (
              user.age ? `${user.age}세` : "—"
            )}
          </dd>
        </div>
        <div className="py-3 flex gap-4 items-center">
          <dt className="w-28 shrink-0 text-muted-foreground text-sm">그룹</dt>
          <dd className="text-foreground flex-1 min-w-0">
            {user.group_type ? (
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                user.group_type === "유치부"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-sky-100 text-sky-700"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  user.group_type === "유치부" ? "bg-amber-400" : "bg-sky-400"
                }`} />
                {user.group_type}
              </span>
            ) : (
              <span className="text-muted-foreground">미배정</span>
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
              disabled={delPending}
            >
              {delPending ? "삭제 중…" : "삭제"}
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

      {/* 삭제 확인 모달 */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-foreground mb-2">학생 삭제</h3>
            <p className="text-sm text-muted-foreground mb-4">
              <span className="font-medium text-foreground">
                {user.korean_name ?? user.first_name}
              </span> 학생을 휴지통으로 이동합니다. 계속하시겠습니까?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDeleteModal(false)} disabled={delPending}>
                취소
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDeleteConfirm} disabled={delPending}>
                {delPending ? "삭제 중…" : "삭제"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

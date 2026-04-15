"use client";

import type { UserWithProfile } from "@/lib/types";
import type { updateStudentProfile } from "../../actions";
import { getStudentLinkedCounts } from "../../actions";
import { usePasswordReset } from "../../hooks/usePasswordReset";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormGroup } from "@/components/FormGroup";
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
  const [groupType, setGroupType] = useState<"유치부" | "오후반" | "">(user.group_type ?? "");
  const {
    show: showPwReset,
    newPassword,
    setNewPassword,
    pending: pwPending,
    message: pwMessage,
    open: openPwReset,
    generatePassword,
    handleReset: handleResetPassword,
    reset: resetPw,
  } = usePasswordReset(user.id, user.email ?? undefined);
  const [delPending, setDelPending] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{
    attendanceCount: number;
    busDefaultCount: number;
    progressCount: number;
  } | null>(null);
  const [deleteModalLoading, setDeleteModalLoading] = useState(false);

  const handleStartEdit = () => {
    setKoreanName(user.korean_name ?? user.first_name ?? "");
    setEnglishName(user.english_name ?? user.last_name ?? "");
    setAge(user.age?.toString() ?? "");
    setGroupType(user.group_type ?? "");
    setError(null);
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setError(null);
    setKoreanName(user.korean_name ?? user.first_name ?? "");
    setEnglishName(user.english_name ?? user.last_name ?? "");
    setAge(user.age?.toString() ?? "");
    setGroupType(user.group_type ?? "");
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
    form.set("group_type", groupType);
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

  const handleDelete = async () => {
    setDeleteModalLoading(true);
    const counts = await getStudentLinkedCounts(user.id);
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
    setSaveMessage({ type: "success", text: "휴지통으로 이동되었습니다." });
    setTimeout(() => {
      router.push("/admin/students");
      router.refresh();
    }, 1500);
  };

  return (
    <div className="max-w-xl">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-xl font-semibold text-foreground">학생 정보</h2>
        {!editing ? (
          <Button variant="outline" onClick={handleStartEdit}>
            수정
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleCancel}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={pending}>
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

      {editing ? (
        <div className="space-y-4">
          <div className="py-2 flex gap-4 items-center">
            <span className="w-28 shrink-0 text-base text-slate-600">아이디</span>
            <span className="text-base text-slate-900 font-mono">{user.email?.split("@")[0] || "—"}</span>
          </div>
          <FormGroup label="한글 이름" required>
            <Input
              type="text"
              value={koreanName}
              onChange={(e) => setKoreanName(e.target.value)}
              placeholder="한글 이름"
            />
          </FormGroup>
          <FormGroup label="영어 이름">
            <Input
              type="text"
              value={englishName}
              onChange={(e) => setEnglishName(e.target.value)}
              placeholder="영어 이름"
            />
          </FormGroup>
          <FormGroup label="나이">
            <Input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              min={3}
              max={20}
              placeholder="나이"
            />
          </FormGroup>
          <FormGroup label="그룹">
            <select
              value={groupType}
              onChange={(e) => setGroupType(e.target.value as "유치부" | "오후반" | "")}
              className="flex h-11 w-full max-w-[200px] rounded-md border border-input bg-transparent px-3 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">미지정</option>
              <option value="유치부">유치부</option>
              <option value="오후반">오후반</option>
            </select>
          </FormGroup>
        </div>
      ) : (
        <dl className="divide-y divide-border">
          <div className="py-3 flex gap-4">
            <dt className="w-28 shrink-0 text-slate-500 text-base">아이디</dt>
            <dd className="text-foreground text-base font-mono">{user.email?.split("@")[0] || "—"}</dd>
          </div>
          <div className="py-3 flex gap-4 items-center">
            <dt className="w-28 shrink-0 text-slate-500 text-base">한글 이름</dt>
            <dd className="text-foreground text-base flex-1 min-w-0">{(user.korean_name ?? user.first_name) || "—"}</dd>
          </div>
          <div className="py-3 flex gap-4 items-center">
            <dt className="w-28 shrink-0 text-slate-500 text-base">영어 이름</dt>
            <dd className="text-foreground text-base flex-1 min-w-0">{(user.english_name ?? user.last_name) || "—"}</dd>
          </div>
          <div className="py-3 flex gap-4 items-center">
            <dt className="w-28 shrink-0 text-slate-500 text-base">나이</dt>
            <dd className="text-foreground text-base flex-1 min-w-0">{user.age ? `${user.age}세` : "—"}</dd>
          </div>
          <div className="py-3 flex gap-4 items-center">
            <dt className="w-28 shrink-0 text-slate-500 text-base">그룹</dt>
            <dd className="text-foreground flex-1 min-w-0">
              {user.group_type ? (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${
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
                <span className="text-muted-foreground text-base">미배정</span>
              )}
            </dd>
          </div>
        </dl>
      )}

      <Separator className="my-4" />

      <div className="flex items-center gap-3">
        {!showPwReset ? (
          <>
            <Button
              variant="outline"
              className="text-amber-700 border-amber-200 hover:bg-amber-50"
              onClick={openPwReset}
            >
              비밀번호 재설정
            </Button>
            <Button
              variant="outline"
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
                variant="outline"
                size="sm"
                className="shrink-0"
                type="button"
                onClick={generatePassword}
              >
                자동 생성
              </Button>
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
                onClick={resetPw}
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
        danger
        title="이 학생을 삭제하시겠습니까?"
        description={(() => {
          const name = user.korean_name ?? user.first_name ?? "이 학생";
          return `${name} 학생 계정이 휴지통으로 이동됩니다.`;
        })()}
        impactList={(() => {
          const items: string[] = [];
          if (deleteModal) {
            if (deleteModal.attendanceCount > 0) items.push(`출결 기록 ${deleteModal.attendanceCount}건이 함께 삭제됩니다`);
            if (deleteModal.progressCount > 0) items.push(`교재 진도 ${deleteModal.progressCount}건이 함께 삭제됩니다`);
            if (deleteModal.busDefaultCount > 0) items.push(`버스 기본 배정 ${deleteModal.busDefaultCount}건이 함께 삭제됩니다`);
          }
          if (items.length === 0) items.push("관련 출결·승하차·리포트카드 데이터가 함께 삭제됩니다.");
          return items;
        })()}
        confirmLabel={delPending ? "삭제 중…" : "삭제"}
        disabled={delPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModal(null)}
      />
    </div>
  );
}

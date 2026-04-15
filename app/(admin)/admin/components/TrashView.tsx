"use client";

import type { UserWithProfile } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";

type Variant = "student" | "teacher";

export function TrashView({
  users,
  variant,
  onRestore,
  onPermanentDelete,
}: {
  users: UserWithProfile[];
  variant: Variant;
  onRestore: (userId: string) => Promise<{ error?: string }>;
  onPermanentDelete: (userId: string) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Record<string, "restore" | "delete" | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string } | null>(null);

  const handleRestore = async (userId: string) => {
    setPending((p) => ({ ...p, [userId]: "restore" }));
    setError(null);
    const result = await onRestore(userId);
    setPending((p) => ({ ...p, [userId]: null }));
    if (result?.error) {
      setError(result.error);
      return;
    }
    toast.success("복구되었습니다.");
    router.refresh();
  };

  const performPermanentDelete = async (userId: string) => {
    setPending((p) => ({ ...p, [userId]: "delete" }));
    setError(null);
    const result = await onPermanentDelete(userId);
    setPending((p) => ({ ...p, [userId]: null }));
    if (result?.error) {
      setError(result.error);
      return;
    }
    toast.success("영구 삭제되었습니다.");
    router.refresh();
  };

  const title = variant === "student" ? "삭제된 학생" : "삭제된 선생";

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-4">{title}</h2>

      {error && (
        <p className="mb-3 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
      )}

      {users.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-slate-50/50 p-8 text-center text-sm text-muted-foreground">
          휴지통이 비어 있습니다.
        </div>
      ) : (
        <div className="rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground">이름</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground">
                  {variant === "student" ? "학번" : "교번"}
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground">아이디</th>
                <th className="py-3 px-4 text-right text-xs font-medium text-muted-foreground">작업</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const name =
                  variant === "student"
                    ? [user.korean_name, user.english_name].filter(Boolean).join(" / ") ||
                      user.first_name ||
                      "—"
                    : user.name ?? user.first_name ?? "—";
                const number =
                  variant === "student"
                    ? user.student_number ?? "—"
                    : user.teacher_number ?? "—";
                const userPending = pending[user.id];
                return (
                  <tr key={user.id} className="border-b last:border-b-0">
                    <td className="py-3 px-4 font-medium">{name}</td>
                    <td className="py-3 px-4 font-mono text-muted-foreground">{number}</td>
                    <td className="py-3 px-4 font-mono text-muted-foreground">{user.email?.split("@")[0] || "—"}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                          onClick={() => handleRestore(user.id)}
                          disabled={!!userPending}
                        >
                          {userPending === "restore" ? "복구 중…" : "복구"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => setConfirmTarget({ id: user.id, name })}
                          disabled={!!userPending}
                        >
                          {userPending === "delete" ? "삭제 중…" : "영구 삭제"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmTarget}
        title={confirmTarget ? `"${confirmTarget.name}"을(를) 영구 삭제하시겠습니까?` : ""}
        confirmLabel="영구 삭제"
        danger
        impactList={[
          "관련된 모든 리포트카드, 교재 진도, 시간표 등이 함께 삭제됩니다.",
          "이 작업은 되돌릴 수 없습니다.",
        ]}
        onConfirm={() => {
          if (confirmTarget) {
            const id = confirmTarget.id;
            setConfirmTarget(null);
            performPermanentDelete(id);
          }
        }}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}

"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/overlays/Modal";
import { LogOut } from "lucide-react";

type LogoutLabels = {
  button?: string;
  title?: string;
  message?: string;
  cancel?: string;
  confirm?: string;
  confirming?: string;
};

export function LogoutButton({
  className,
  children,
  labels,
}: {
  className?: string;
  children?: React.ReactNode;
  labels?: LogoutLabels;
} = {}) {
  const L = {
    button: labels?.button ?? "로그아웃",
    title: labels?.title ?? "로그아웃",
    message: labels?.message ?? "정말 로그아웃 하시겠습니까?",
    cancel: labels?.cancel ?? "취소",
    confirm: labels?.confirm ?? "로그아웃",
    confirming: labels?.confirming ?? "로그아웃 중…",
  };
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className={
          "text-sm font-medium cursor-pointer transition-colors active:scale-95 " +
          (className ??
            "px-4 py-2 text-muted-foreground bg-secondary rounded-lg hover:bg-destructive/10 hover:text-destructive")
        }
      >
        {children}
        <span>{L.button}</span>
      </button>

      <Modal open={showConfirm} onClose={() => setShowConfirm(false)} size="sm">
        <div className="p-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <LogOut className="size-6" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">{L.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{L.message}</p>
            </div>
            <div className="mt-1 flex w-full gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 cursor-pointer rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
              >
                {L.cancel}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex-1 cursor-pointer rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {loggingOut ? L.confirming : L.confirm}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

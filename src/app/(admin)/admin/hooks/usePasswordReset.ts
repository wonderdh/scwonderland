"use client";

import { useState } from "react";
import { resetUserPassword } from "@/app/(admin)/admin/actions/user-actions";

type PwMessage = { type: "error" | "success"; text: string } | null;

export function usePasswordReset(userId: string, email?: string) {
  const [show, setShow] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<PwMessage>(null);

  function open() {
    setShow(true);
    setNewPassword("");
    setMessage(null);
  }

  function reset() {
    setShow(false);
    setNewPassword("");
    setMessage(null);
  }

  function generatePassword() {
    const prefix = email?.split("@")[0] ?? "";
    const rand = Math.floor(1000 + Math.random() * 9000);
    setNewPassword(`${prefix}${rand}`);
  }

  async function handleReset() {
    if (!newPassword.trim()) {
      setMessage({ type: "error", text: "새 비밀번호를 입력해 주세요." });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "비밀번호는 최소 6자 이상이어야 합니다." });
      return;
    }
    setPending(true);
    setMessage(null);
    const result = await resetUserPassword(userId, newPassword);
    setPending(false);
    if (result?.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setMessage({ type: "success", text: "비밀번호가 변경되었습니다." });
    setNewPassword("");
    setTimeout(() => {
      reset();
    }, 2000);
  }

  return {
    show,
    setShow,
    newPassword,
    setNewPassword,
    pending,
    message,
    open,
    generatePassword,
    handleReset,
    reset,
  };
}

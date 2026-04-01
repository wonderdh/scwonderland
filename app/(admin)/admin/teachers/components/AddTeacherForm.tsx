"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createTeacher } from "../../actions";
import { Spinner } from "@/components/Spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type FormState = { error?: string; success?: string } | null;

function generatePassword(email: string): string {
  const prefix = email.trim() || "teacher";
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${rand}`;
}

export function AddTeacherForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [state, formAction, isPending] = useActionState(
    async (_: FormState, formData: FormData) => {
      const result = await createTeacher(formData);
      if (result.error) return { error: result.error };
      formRef.current?.reset();
      setPassword("");
      setEmailValue("");
      router.refresh();
      toast.success("교사가 추가되었습니다.");
      return { success: "교사가 추가되었습니다." };
    },
    null as FormState
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-wrap items-end gap-3 p-4 rounded-xl border bg-card"
    >
      <div className="min-w-[140px]">
        <Label htmlFor="teacher-email">
          아이디 <span className="text-destructive">*</span>
        </Label>
        <Input
          id="teacher-email"
          type="text"
          name="email"
          required
          placeholder="test1"
          autoComplete="off"
          disabled={isPending}
          value={emailValue}
          onChange={(e) => setEmailValue(e.target.value)}
          className="mt-1"
        />
      </div>
      <div className="min-w-[160px]">
        <Label htmlFor="teacher-password">
          비밀번호 <span className="text-destructive">*</span>
        </Label>
        <div className="mt-1 flex gap-1">
          <Input
            id="teacher-password"
            type="text"
            name="password"
            required
            autoComplete="new-password"
            disabled={isPending}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            className="flex-1 min-w-0"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 text-xs"
            disabled={isPending}
            onClick={() => setPassword(generatePassword(emailValue))}
          >
            자동생성
          </Button>
        </div>
      </div>
      <div className="min-w-[120px]">
        <Label htmlFor="teacher-name">
          이름 <span className="text-destructive">*</span>
        </Label>
        <Input
          id="teacher-name"
          type="text"
          name="name"
          required
          placeholder="김선생"
          disabled={isPending}
          className="mt-1"
        />
      </div>
      <div className="min-w-[120px]">
        <Label htmlFor="teacher-type">
          유형 <span className="text-destructive">*</span>
        </Label>
        <select
          id="teacher-type"
          name="teacher_type"
          required
          disabled={isPending}
          className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="korean">한국인</option>
          <option value="native">원어민</option>
        </select>
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? <><Spinner size="sm" /> 추가 중...</> : "추가"}</Button>
      <p className="w-full text-xs text-muted-foreground">* 필수 입력</p>
      {state?.error && (
        <p className="w-full text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="w-full text-sm text-green-600" role="status">
          {state.success}
        </p>
      )}
    </form>
  );
}

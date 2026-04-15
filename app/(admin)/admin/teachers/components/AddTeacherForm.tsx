"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toastSuccess } from "@/lib/ui/toast";
import { createTeacher } from "../../actions";
import { Spinner } from "@/components/feedback/Spinner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormGroup } from "@/components/forms/FormGroup";

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
      toastSuccess("교사가 추가되었습니다.");
      return { success: "교사가 추가되었습니다." };
    },
    null as FormState
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5 rounded-xl border bg-card"
    >
      <FormGroup label="아이디" htmlFor="teacher-email" required>
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
        />
      </FormGroup>
      <FormGroup label="비밀번호" htmlFor="teacher-password" required>
        <div className="flex gap-1">
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
            className="shrink-0"
            disabled={isPending}
            onClick={() => setPassword(generatePassword(emailValue))}
          >
            자동생성
          </Button>
        </div>
      </FormGroup>
      <FormGroup label="이름" htmlFor="teacher-name" required>
        <Input
          id="teacher-name"
          type="text"
          name="name"
          required
          placeholder="김선생"
          disabled={isPending}
        />
      </FormGroup>
      <FormGroup label="유형" htmlFor="teacher-type" required>
        <select
          id="teacher-type"
          name="teacher_type"
          required
          disabled={isPending}
          className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="korean">한국인</option>
          <option value="native">원어민</option>
        </select>
      </FormGroup>

      <div className="md:col-span-2 lg:col-span-3 flex items-center justify-between pt-2 border-t border-slate-200">
        <p className="text-sm text-slate-500">* 필수 입력</p>
        <Button type="submit" disabled={isPending}>
          {isPending ? (<><Spinner size="sm" /> 추가 중...</>) : "추가"}
        </Button>
      </div>
      {state?.error && (
        <p className="md:col-span-2 lg:col-span-3 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="md:col-span-2 lg:col-span-3 text-sm text-green-600" role="status">
          {state.success}
        </p>
      )}
    </form>
  );
}

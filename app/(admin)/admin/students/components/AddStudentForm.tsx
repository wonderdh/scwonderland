"use client";

import { useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createStudent } from "../../actions";
import { Spinner } from "@/components/Spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type FormState = { error?: string; success?: string } | null;

export function AddStudentForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    async (_: FormState, formData: FormData) => {
      const result = await createStudent(formData);
      if (result.error) return { error: result.error };
      formRef.current?.reset();
      router.refresh();
      toast.success("학생이 추가되었습니다.");
      return { success: "학생이 추가되었습니다." };
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
        <Label htmlFor="student-email">
          아이디 <span className="text-destructive">*</span>
        </Label>
        <Input
          id="student-email"
          type="text"
          name="email"
          required
          placeholder="test1"
          autoComplete="off"
          disabled={isPending}
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-0.5">@ 없이 쓰면 도메인 자동 추가</p>
      </div>
      <div className="min-w-[120px]">
        <Label htmlFor="student-password">
          비밀번호 <span className="text-destructive">*</span>
        </Label>
        <Input
          id="student-password"
          type="password"
          name="password"
          required
          autoComplete="new-password"
          disabled={isPending}
          className="mt-1"
        />
      </div>
      <div className="min-w-[120px]">
        <Label htmlFor="student-korean-name">
          한글 이름 <span className="text-destructive">*</span>
        </Label>
        <Input
          id="student-korean-name"
          type="text"
          name="korean_name"
          required
          placeholder="홍길동"
          disabled={isPending}
          className="mt-1"
        />
      </div>
      <div className="min-w-[120px]">
        <Label htmlFor="student-english-name">영어 이름</Label>
        <Input
          id="student-english-name"
          type="text"
          name="english_name"
          placeholder="John Hong"
          disabled={isPending}
          className="mt-1"
        />
      </div>
      <div className="min-w-[80px] max-w-[100px]">
        <Label htmlFor="student-age">나이</Label>
        <Input
          id="student-age"
          type="number"
          name="age"
          min={3}
          max={20}
          placeholder="7"
          disabled={isPending}
          className="mt-1"
        />
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

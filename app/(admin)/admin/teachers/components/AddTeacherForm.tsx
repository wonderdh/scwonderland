"use client";

import { useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createTeacher } from "../../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type FormState = { error?: string; success?: string } | null;

export function AddTeacherForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (_: FormState, formData: FormData) => {
      const result = await createTeacher(formData);
      if (result.error) return { error: result.error };
      formRef.current?.reset();
      router.refresh();
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
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-0.5">@ 없이 쓰면 도메인 자동 추가</p>
      </div>
      <div className="min-w-[120px]">
        <Label htmlFor="teacher-password">
          비밀번호 <span className="text-destructive">*</span>
        </Label>
        <Input
          id="teacher-password"
          type="password"
          name="password"
          required
          autoComplete="new-password"
          className="mt-1"
        />
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
          className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="korean">한국인</option>
          <option value="native">원어민</option>
        </select>
      </div>
      <Button type="submit">추가</Button>
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

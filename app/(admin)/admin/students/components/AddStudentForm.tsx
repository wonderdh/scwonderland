"use client";

import { useActionState } from "react";
import { createStudent } from "../../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function AddStudentForm() {
  const [state, formAction] = useActionState(
    async (_: { error?: string } | null, formData: FormData) => {
      return createStudent(formData);
    },
    null as { error?: string } | null
  );

  return (
    <form
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
          className="mt-1"
        />
      </div>
      <Button type="submit">추가</Button>
      <p className="w-full text-xs text-muted-foreground">* 필수 입력</p>
      {state?.error && (
        <p className="w-full text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

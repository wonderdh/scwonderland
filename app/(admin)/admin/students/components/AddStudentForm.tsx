"use client";

import { useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toastSuccess } from "@/lib/toast";
import { createStudent } from "../../actions";
import { Spinner } from "@/components/Spinner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormGroup } from "@/components/FormGroup";

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
      toastSuccess("학생이 추가되었습니다.");
      return { success: "학생이 추가되었습니다." };
    },
    null as FormState
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5 rounded-xl border bg-card"
    >
      <FormGroup label="아이디" htmlFor="student-email" required>
        <Input
          id="student-email"
          type="text"
          name="email"
          required
          placeholder="test1"
          autoComplete="off"
          disabled={isPending}
        />
      </FormGroup>
      <FormGroup label="비밀번호" htmlFor="student-password" required>
        <Input
          id="student-password"
          type="password"
          name="password"
          required
          autoComplete="new-password"
          disabled={isPending}
        />
      </FormGroup>
      <FormGroup label="한글 이름" htmlFor="student-korean-name" required>
        <Input
          id="student-korean-name"
          type="text"
          name="korean_name"
          required
          placeholder="홍길동"
          disabled={isPending}
        />
      </FormGroup>
      <FormGroup label="영어 이름" htmlFor="student-english-name">
        <Input
          id="student-english-name"
          type="text"
          name="english_name"
          placeholder="John Hong"
          disabled={isPending}
        />
      </FormGroup>
      <FormGroup label="나이" htmlFor="student-age">
        <Input
          id="student-age"
          type="number"
          name="age"
          min={3}
          max={20}
          placeholder="7"
          disabled={isPending}
        />
      </FormGroup>
      <FormGroup label="그룹" htmlFor="student-group">
        <select
          id="student-group"
          name="group_type"
          disabled={isPending}
          className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">미지정</option>
          <option value="유치부">유치부</option>
          <option value="오후반">오후반</option>
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

"use client";

import { useActionState } from "react";
import { createStudent } from "../actions";

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
      className="flex flex-wrap items-end gap-3 p-4 bg-white rounded-xl border border-slate-200"
    >
      <div className="min-w-[140px]">
        <label className="block text-xs font-medium text-slate-500 mb-1">
          아이디 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="email"
          required
          placeholder="test1"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 text-sm"
        />
        <p className="text-xs text-slate-400 mt-0.5">@ 없이 쓰면 도메인 자동 추가</p>
      </div>
      <div className="min-w-[120px]">
        <label className="block text-xs font-medium text-slate-500 mb-1">
          비밀번호 <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          name="password"
          required
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 text-sm"
        />
      </div>
      <div className="min-w-[120px]">
        <label className="block text-xs font-medium text-slate-500 mb-1">
          한글 이름 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          name="korean_name"
          required
          placeholder="홍길동"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 text-sm"
        />
      </div>
      <div className="min-w-[120px]">
        <label className="block text-xs font-medium text-slate-500 mb-1">
          영어 이름
        </label>
        <input
          type="text"
          name="english_name"
          placeholder="John Hong"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 text-sm"
        />
      </div>
      <button
        type="submit"
        className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700"
      >
        추가
      </button>
      <p className="w-full text-xs text-slate-400">* 필수 입력</p>
      {state?.error && (
        <p className="w-full text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

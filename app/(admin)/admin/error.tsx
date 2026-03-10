"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AdminError]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-xl font-semibold text-gray-900">
        관리자 페이지 오류
      </h2>
      <p className="text-sm text-gray-600">
        페이지를 불러오는 중 오류가 발생했습니다. 다시 시도해 주세요.
      </p>
      <button
        onClick={reset}
        className="rounded-md bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700"
      >
        다시 시도
      </button>
    </div>
  );
}

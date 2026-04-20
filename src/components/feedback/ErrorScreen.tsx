"use client";

import { useEffect } from "react";

interface ErrorScreenProps {
  error: Error & { digest?: string };
  reset: () => void;
  logTag: string;
  title?: string;
  description?: string;
  resetLabel?: string;
}

export function ErrorScreen({
  error,
  reset,
  logTag,
  title = "문제가 발생했습니다",
  description = "페이지를 불러오는 중 오류가 발생했습니다. 다시 시도해 주세요.",
  resetLabel = "다시 시도",
}: ErrorScreenProps) {
  useEffect(() => {
    console.error(logTag, error);
  }, [error, logTag]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-600">{description}</p>
      <button
        onClick={reset}
        className="rounded-md bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700"
      >
        {resetLabel}
      </button>
    </div>
  );
}

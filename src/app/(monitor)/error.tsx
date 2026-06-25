"use client";

import { useEffect } from "react";

/**
 * 버스/급식 모니터(무인 TV 디스플레이) 전용 error boundary.
 * 사람이 옆에 없으므로, 오류 시 일정 시간 후 자동으로 복구를 시도한다.
 */
export default function MonitorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[MonitorError]", error);
    const timer = setTimeout(() => reset(), 10_000);
    return () => clearTimeout(timer);
  }, [error, reset]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-900 p-12 text-center text-white">
      <h2 className="text-4xl font-bold">일시적인 오류가 발생했습니다</h2>
      <p className="text-xl text-slate-300">잠시 후 자동으로 다시 연결합니다…</p>
      <button
        onClick={reset}
        className="rounded-lg bg-slate-700 px-6 py-3 text-lg transition-colors hover:bg-slate-600"
      >
        지금 다시 시도
      </button>
    </div>
  );
}

"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/** Supabase Auth 에러를 사용자에게 보여줄 한글 메시지로 변환 */
function getLoginErrorMessage(err: { message?: string; code?: string }): string {
  const code = (err as { code?: string }).code;
  const msg = (err.message ?? "").toLowerCase();

  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
    return "아이디 또는 비밀번호가 올바르지 않습니다.";
  }
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "이메일 인증이 완료되지 않았습니다. 메일함을 확인해 주세요.";
  }
  if (code === "user_banned" || msg.includes("banned")) {
    return "해당 계정은 이용이 제한되었습니다.";
  }
  if (code === "over_request_rate_limit" || msg.includes("rate limit") || msg.includes("too many")) {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (code === "email_provider_disabled" || msg.includes("signups are disabled")) {
    return "이메일 로그인이 비활성화되어 있습니다.";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
  }

  return err.message ?? "로그인에 실패했습니다. 다시 시도해 주세요.";
}

export default function AcademyLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/academy/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() =>
    searchParams.get("error") === "admin_only"
      ? "Admin만 접근할 수 있습니다."
      : null
  );
  const [loading, setLoading] = useState(false);

  function toFullEmail(value: string): string {
    const v = value.trim();
    if (!v) return v;
    return v.includes("@") ? v : `${v}@scwonderland.com`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const fullEmail = toFullEmail(email);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: fullEmail,
      password,
    });
    setLoading(false);
    if (err) {
      console.error("[로그인 실패]", err);
      setError(getLoginErrorMessage(err));
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="max-w-sm mx-auto mt-12 p-6 bg-white rounded-xl shadow-sm border border-slate-200">
      <h1 className="text-xl font-semibold text-slate-800 mb-2">
        학원 로그인
      </h1>
      <p className="text-slate-500 text-sm mb-6">
        아이디만 입력하면 @scwonderland.com은 자동으로 붙습니다.
      </p>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            아이디
          </label>
          <input
            type="text"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400"
            placeholder="test1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            비밀번호
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
            placeholder="비밀번호"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? "로그인 중…" : "로그인"}
        </button>
      </form>
    </div>
  );
}

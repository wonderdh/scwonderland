"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/Spinner";
import { normalizeEmail, getAuthErrorMessage } from "@/lib/auth-utils";

const DEFAULT_REDIRECT = "/academy/dashboard";

/**
 * next 파라미터 검증: 같은 오리진 내부 경로만 허용.
 * - 빈 문자열, null, 절대 URL("//evil.com", "https://..."), 프로토콜 상대 URL 모두 차단
 */
function safeRedirect(next: string | null): string {
  const trimmed = next?.trim();
  if (!trimmed) return DEFAULT_REDIRECT;
  if (!trimmed.startsWith("/")) return DEFAULT_REDIRECT;
  if (trimmed.startsWith("//")) return DEFAULT_REDIRECT;
  // 백슬래시는 일부 브라우저가 '/'로 해석 → 차단
  if (trimmed.includes("\\")) return DEFAULT_REDIRECT;
  return trimmed;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeRedirect(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() =>
    searchParams.get("error") === "admin_only"
      ? "Admin만 접근할 수 있습니다."
      : null
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });
    if (err) {
      setLoading(false);
      console.error("[로그인 실패]", err);
      setError(getAuthErrorMessage(err));
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-sm overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-red-500 via-yellow-400 via-green-500 to-blue-500" />
        <CardHeader className="text-center pt-8">
          <div className="mx-auto mb-2">
            <Image
              src="/sc-wonderland-logo.png"
              alt="원더랜드 로고"
              width={140}
              height={80}
              className="mx-auto"
              priority
            />
          </div>
          <CardTitle className="text-xl">원더랜드 로그인</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8">
              <Spinner size="md" />
              <p className="text-sm text-slate-500 animate-pulse">로그인 중…</p>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="login-email">아이디</Label>
                <Input
                  id="login-email"
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  placeholder="test1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">비밀번호</Label>
                <Input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="비밀번호"
                />
              </div>
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700" role="alert">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 hover:from-red-600 hover:via-orange-600 hover:to-yellow-600 text-white shadow-md"
              >
                로그인
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/server/logger";
import { requireEnv } from "@/lib/env";

const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile/i;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ua = request.headers.get("user-agent") ?? "";

  // /admin (루트만) → 모바일이면 /m으로 리다이렉트
  if (pathname === "/admin" && MOBILE_UA.test(ua)) {
    return NextResponse.redirect(new URL("/m", request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    requireEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 세션 갱신 (실패해도 요청은 그대로 통과시키기)
  try {
    await supabase.auth.getUser();
  } catch (e) {
    // Supabase 422 등 에러 시에도 페이지는 정상 응답
    logger.error("[proxy]", "세션 갱신 실패", {
      pathname,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  return response;
}

export const config = {
  matcher: [
    // 정적 리소스(이미지·폰트·CSS·JS·아이콘)와 Next.js 내부 경로는 proxy 대상에서 제외.
    // Supabase 세션 갱신 오버헤드를 줄이고 Core Web Vitals를 보호.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf|otf|eot|css|js|map|txt|xml|json)$).*)",
  ],
};

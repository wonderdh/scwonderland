import { redirect } from "next/navigation";

// 로그인 화면은 /login 으로 이관. 기존 링크·북마크 호환용 stub.
export default async function LegacyAcademyLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  const qs = params.toString();
  redirect(qs ? `/login?${qs}` : "/login");
}

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "../components/LogoutButton";

export default async function AcademyDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-slate-800 mb-6">
          대시보드
        </h1>
        <p className="text-slate-600 mb-8">
          로그인 후 역할에 따라 아래 메뉴가 표시됩니다.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/academy/student"
            className="block p-5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition"
          >
            <span className="text-lg font-medium text-slate-800">학생</span>
            <p className="mt-1 text-sm text-slate-500">
              숙제 제출 · 내 성적 보기
            </p>
          </Link>
          <Link
            href="/academy/teacher"
            className="block p-5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition"
          >
            <span className="text-lg font-medium text-slate-800">선생님</span>
            <p className="mt-1 text-sm text-slate-500">
              담당 학생 리포트 카드 작성
            </p>
          </Link>
        </div>
        <p className="mt-8 text-sm text-slate-500">
          <Link href="/academy/login" className="underline hover:text-slate-700">
            로그인 페이지로 이동
          </Link>
        </p>
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") {
    redirect("/admin");
  }

  const role = profile?.role ?? null;
  const roleLabel =
    role === "admin"
      ? "Admin"
      : role === "teacher"
        ? "Teacher"
        : role === "student"
          ? "Student"
          : "null (미지정)";

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-slate-800 mb-2">
        로그인 성공
      </h1>
      <p className="text-slate-600 mb-6">
        <strong>역할(role):</strong> {roleLabel}
      </p>
      <LogoutButton />
    </div>
  );
}

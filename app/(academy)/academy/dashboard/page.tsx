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
    redirect("/academy/login?next=/academy/dashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") {
    redirect("/admin");
  }

  if (profile?.role === "student") {
    redirect("/academy/student");
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
      <div className="flex flex-wrap gap-4">
        <Link
          href="/academy/teacher"
          className="block p-5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition"
        >
          <span className="text-lg font-medium text-slate-800">선생님 페이지</span>
          <p className="mt-1 text-sm text-slate-500">담당 학생·리포트 등</p>
        </Link>
      </div>
      <p className="mt-6">
        <LogoutButton />
      </p>
    </div>
  );
}

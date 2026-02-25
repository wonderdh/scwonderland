import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

export default async function AcademyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <Link
          href="/academy/dashboard"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Image
            src="/sc-wonderland-logo.png"
            alt="원더랜드 로고"
            width={100}
            height={40}
            className="h-8 w-auto"
          />
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/academy/dashboard"
            className="text-slate-600 hover:text-slate-900"
          >
            대시보드
          </Link>
          <span className="text-slate-400">|</span>
          <Link
            href="/"
            className="text-slate-500 hover:text-slate-700"
          >
            학원 소개 사이트
          </Link>
          {user && (
            <>
              <span className="text-slate-400">|</span>
              <LogoutButton className="text-muted-foreground hover:text-red-600 font-medium px-2 py-1 bg-transparent hover:bg-red-50 rounded-md" />
            </>
          )}
        </nav>
      </header>
      <main className="flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}

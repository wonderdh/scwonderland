import Image from "next/image";
import Link from "next/link";
import { LogoutButton } from "@/components/navigation/LogoutButton";

type Props = {
  role?: "admin" | "teacher" | "student" | null;
  displayName?: string | null;
  isNative?: boolean;
  children: React.ReactNode;
};

export function AcademyShell({
  role,
  displayName,
  isNative = false,
  children,
}: Props) {
  const homeHref =
    role === "admin"
      ? "/admin"
      : role === "teacher"
        ? "/academy/teacher"
        : role === "student"
          ? "/academy/student"
          : "/dashboard";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <Link
          href={homeHref}
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
        <nav className="flex items-center gap-2 sm:gap-4 text-sm">
          {role && (
            <>
              <Link
                href={homeHref}
                className="text-slate-600 hover:text-slate-900"
              >
                {isNative ? "Dashboard" : "대시보드"}
              </Link>
              <span className="hidden sm:inline text-slate-400">|</span>
            </>
          )}
          <Link
            href="/"
            className="hidden sm:inline text-slate-500 hover:text-slate-700"
          >
            {isNative ? "School Website" : "학원 소개 사이트"}
          </Link>
          {displayName && (
            <>
              <span className="text-slate-400">|</span>
              <span className="text-slate-700 font-medium max-w-[80px] sm:max-w-none truncate">
                {displayName}
              </span>
            </>
          )}
          {role && (
            <>
              <span className="text-slate-400">|</span>
              <LogoutButton
                className="text-muted-foreground hover:text-red-600 font-medium px-2 py-1 bg-transparent hover:bg-red-50 rounded-md"
                labels={
                  isNative
                    ? {
                        button: "Logout",
                        title: "Logout",
                        message: "Are you sure you want to log out?",
                        cancel: "Cancel",
                        confirm: "Logout",
                        confirming: "Logging out…",
                      }
                    : undefined
                }
              />
            </>
          )}
        </nav>
      </header>
      <main className="flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}

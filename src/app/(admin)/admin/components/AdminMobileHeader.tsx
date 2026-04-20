"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { LogoutButton } from "@/components/navigation/LogoutButton";
import { AdminSidebar } from "./AdminSidebar";
import { getBreadcrumbForPath } from "@/lib/navigation/admin-nav";

export function AdminMobileHeader({ adminId }: { adminId: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const breadcrumb = getBreadcrumbForPath(pathname);
  const title = breadcrumb[breadcrumb.length - 1]?.label ?? "관리자";

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  useEffect(() => {
    close();
  }, [pathname]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  return (
    <>
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-3 bg-white border-b border-slate-200">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="메뉴 열기"
          className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-slate-100"
        >
          <Menu className="h-6 w-6" />
        </button>
        <h1 className="text-base font-semibold text-slate-800 truncate px-2">
          {title}
        </h1>
        <LogoutButton className="h-11 px-3 rounded-lg flex items-center gap-1 text-sm text-slate-700 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer">
          로그아웃
        </LogoutButton>
      </header>

      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={close}
          aria-hidden
        />
      )}
      <div
        className={`lg:hidden fixed left-0 top-0 bottom-0 w-72 bg-white z-50 shadow-2xl transform transition-transform ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="관리자 메뉴"
      >
        <div className="relative h-full flex flex-col">
          <button
            type="button"
            onClick={close}
            aria-label="메뉴 닫기"
            className="absolute top-3 right-3 h-10 w-10 flex items-center justify-center rounded-lg hover:bg-slate-100 z-10"
          >
            <X className="h-5 w-5" />
          </button>
          <AdminSidebar adminId={adminId} onItemClick={close} />
        </div>
      </div>
    </>
  );
}

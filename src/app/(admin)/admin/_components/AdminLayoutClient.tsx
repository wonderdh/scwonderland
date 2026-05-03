"use client";

import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/app/(admin)/admin/_components/AdminSidebar";
import { AdminMobileHeader } from "@/app/(admin)/admin/_components/AdminMobileHeader";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { getBreadcrumbForPath } from "@/lib/navigation/admin-nav";

export function AdminLayoutClient({
  children,
  adminId,
}: {
  children: React.ReactNode;
  adminId: string;
}) {
  const pathname = usePathname();
  const breadcrumbItems = getBreadcrumbForPath(pathname);

  return (
    <div className="admin-root min-h-screen bg-background">
      <div className="hidden lg:flex fixed left-0 top-0 bottom-0 z-30">
        <AdminSidebar adminId={adminId} />
      </div>

      <AdminMobileHeader adminId={adminId} />

      <main className="lg:ml-60 px-4 sm:px-6 lg:px-8 pt-4 lg:pt-6 pb-12 min-w-0">
        <Breadcrumb items={breadcrumbItems} />
        {children}
      </main>
    </div>
  );
}

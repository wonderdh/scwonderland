"use client";

import { AdminSidebar } from "@/app/(admin)/admin/components/AdminSidebar";

export function AdminLayoutClient({
  children,
  adminId,
}: {
  children: React.ReactNode;
  adminId: string;
}) {
  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar adminId={adminId} />
      <main className="flex-1 min-w-0 p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}

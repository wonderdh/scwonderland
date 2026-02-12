"use client";

import { AdminSidebar } from "@/app/(admin)/admin/components/AdminSidebar";
import { AdminSubSidebar } from "@/app/(admin)/admin/components/AdminSubSidebar";
import { usePathname } from "next/navigation";

export function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const showStudentSub = pathname.startsWith("/admin/students");
  const showTeacherSub = pathname.startsWith("/admin/teachers");

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <AdminSidebar />
      {showStudentSub && <AdminSubSidebar variant="students" />}
      {showTeacherSub && <AdminSubSidebar variant="teachers" />}
      <main className="flex-1 min-w-0 p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}

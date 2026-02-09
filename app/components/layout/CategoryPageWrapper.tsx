import Link from "next/link";
import { SideBar } from "@/app/components/sections/SideBar";

type CategoryPageWrapperProps = {
  children: React.ReactNode;
};

export function CategoryPageWrapper({ children }: CategoryPageWrapperProps) {
  return (
    <main className="min-h-screen bg-white">
      <SideBar />
      {children}
      <footer className="border-t border-gray-200 bg-gray-50 py-8">
        <div className="container mx-auto flex flex-wrap items-center justify-center gap-6 px-4 text-center text-sm text-gray-600">
          <Link href="/" className="hover:text-gray-900">
            ← 왜 원드랜드 일까요?
          </Link>
          <span aria-hidden>·</span>
          <span>&copy; 2026 원더랜드 영어학원. All rights reserved.</span>
        </div>
      </footer>
    </main>
  );
}

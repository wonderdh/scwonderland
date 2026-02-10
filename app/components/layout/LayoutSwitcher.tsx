"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./Footer";
import { Navigation } from "./Navigation";
import { SideBar } from "../sections/SideBar";

const ACADEMY_PATH_PREFIX = "/academy";

/**
 * 학원 로그인/대시보드 등은 네비·사이드바·푸터 없이,
 * 공개 사이트(홈, 소개, 프로그램 등)만 기존 레이아웃 적용
 */
export function LayoutSwitcher({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAcademy = pathname?.startsWith(ACADEMY_PATH_PREFIX);

  if (isAcademy) {
    return <>{children}</>;
  }

  return (
    <>
      <Navigation />
      <SideBar />
      {children}
      <Footer />
    </>
  );
}

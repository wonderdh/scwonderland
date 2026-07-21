"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const isFirstRender = useRef(true);
  const pathnameRef = useRef(pathname);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // 네비게이션 완료 시 숨김 — pathname은 외부 router 상태, 변화 시 progress 표시 종료.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
  }, [pathname]);

  // 내부 링크 클릭 시 표시
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        /^https?:\/\//.test(href)
      ) return;

      // 현재 페이지와 같은 경로면 pathname이 변하지 않아 바가 사라지지 않음 — 무시
      const hrefPathname = href.split("?")[0].split("#")[0];
      if (hrefPathname === pathnameRef.current) return;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setVisible(true);
      // 네비게이션 실패/취소 시 대비한 안전 타임아웃
      timeoutRef.current = setTimeout(() => setVisible(false), 8000);
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] overflow-hidden"
    >
      <div className="absolute h-full w-[60%] rounded-full bg-primary nav-progress-bar" />
    </div>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  getDefaultMenuItemHref,
  getMenuIdFromPathname,
  getMenuItemHref,
} from "@/lib/menu-routes";

const menuItems = [
  { id: "about", label: "About Wonderland" },
  { id: "programs", label: "Program" },
  { id: "features", label: "Notice" },
  { id: "gallery", label: "Community" },
  { id: "contact", label: "Experience" },
];

const aboutGreetingHref = "/about-wonderland/greeting";

const megaMenuItems: Record<string, string[]> = {
  about: ["인사말", "회사연혁", "대외기관 인증", "Wonderland"],
  programs: ["MAP", "Wonderland", "Wonder K", "Primo School", "Quest Academy"],
  features: ["News"],
  gallery: ["학부모상담", "가맹문의", "캠퍼스"],
  contact: ["Special Day", "Wonderland E-School", "Library", "Links"],
};

export function Navigation() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const activeMenuId = getMenuIdFromPathname(pathname) ?? "about";
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const getButtonClass = (id: string) => {
    const isActive = activeMenuId === id;
    const isHovered = hoveredId === id;
    const showActive = !hoveredId;

    return [
    [
      "relative pb-1 text-lg font-semibold transition",
      "hover:-translate-y-0.5 hover:text-orange-600",
      "after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full",
      "after:origin-left after:scale-x-0 after:bg-orange-500 after:transition",
      "hover:after:scale-x-100",
        showActive && isActive ? "text-orange-500 after:scale-x-100" : "text-zinc-900",
        isHovered ? "text-orange-600 after:scale-x-100" : "",
      ].join(" "),
    ].join(" ");
  };

  const panelVisible = hoveredId !== null;

  /* 데스크톱: 로고(140px) + 5등분 타이틀. 모바일: 로고 + 햄버거만 */
  const navGridCols =
    "md:grid-cols-[140px_1fr_1fr_1fr_1fr_1fr]";
  const dropdownGridClass = "grid grid-cols-[140px_1fr_1fr_1fr_1fr_1fr]";

  return (
    <nav
      className="fixed left-0 right-0 top-0 z-50 border-b border-black/5 bg-white"
      onMouseLeave={() => setHoveredId(null)}
    >
      <div className={`relative mx-auto flex h-24 w-full max-w-6xl items-center justify-between px-6 md:grid md:justify-items-center md:gap-0 ${navGridCols}`}>
        <Link
          href="/"
          className="flex shrink-0 items-center md:justify-self-start"
        >
          <Image
            src="/sc-wonderland-logo.png"
            alt="SC Wonderland logo"
            width={140}
            height={64}
            priority
          />
        </Link>

        {menuItems.map((item) => {
          const defaultHref = getDefaultMenuItemHref(item.id);
          const isAbout = item.id === "about";
          const linkClass = `hidden md:flex justify-center w-full ${getButtonClass(item.id)}`;
          if (isAbout) {
            return (
              <Link
                key={item.id}
                href={aboutGreetingHref}
                className={linkClass}
                onMouseEnter={() => setHoveredId(item.id)}
              >
                {item.label}
              </Link>
            );
          }
          return (
            <Link
              key={item.id}
              href={defaultHref ?? "/"}
              className={linkClass}
              onMouseEnter={() => setHoveredId(item.id)}
            >
              {item.label}
            </Link>
          );
        })}

        <button
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white md:hidden"
          aria-expanded={isOpen}
          aria-label="메뉴 열기"
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <span className="flex flex-col gap-1.5">
            <span className="h-0.5 w-5 rounded-full bg-white" />
            <span className="h-0.5 w-5 rounded-full bg-white" />
            <span className="h-0.5 w-5 rounded-full bg-white" />
          </span>
        </button>
      </div>

      <div
        className={[
          "absolute left-0 right-0 top-full hidden md:block",
          "bg-zinc-900/95 text-white transition-all duration-200",
          panelVisible
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0",
        ].join(" ")}
        onMouseEnter={() => setHoveredId((prev) => prev ?? "about")}
      >
        <div
          className={`mx-auto max-w-6xl px-6 py-10 text-base ${dropdownGridClass}`}
        >
          <div className="w-[140px] shrink-0" aria-hidden />
          {menuItems.map((menu) => {
            const items = megaMenuItems[menu.id] ?? [];
            return (
              <div
                key={menu.id}
                className="flex min-w-0 flex-col items-center justify-start"
              >
                <ul className="w-full space-y-2 text-center text-white/85">
                  {items.length === 0 ? (
                    <li className="px-2 py-1 text-white/50">준비중</li>
                  ) : (
                    items.map((item) => (
                      <li key={item}>
                        <Link
                          href={getMenuItemHref(menu.id, item)}
                          className="flex w-full justify-center rounded px-2 py-1 text-center text-white/80 transition hover:bg-white/10 hover:text-white"
                        >
                          {item}
                        </Link>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-black/5 bg-white md:hidden">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6 text-base font-semibold text-zinc-900 md:flex-row md:gap-10">
            {menuItems.map((item) => {
              const defaultHref = getDefaultMenuItemHref(item.id);
              if (item.id === "about") {
                return (
                  <Link
                    key={item.id}
                    href={aboutGreetingHref}
                    className={getButtonClass(item.id)}
                    onClick={() => setIsOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              }
              return (
                <Link
                  key={item.id}
                  href={defaultHref ?? "/"}
                  className={getButtonClass(item.id)}
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}

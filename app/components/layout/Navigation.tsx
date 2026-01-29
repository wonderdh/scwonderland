"use client";

import Image from "next/image";
import { useState } from "react";

const menuItems = [
  { id: "about", label: "About Wonderland" },
  { id: "programs", label: "Program" },
  { id: "features", label: "Notice" },
  { id: "gallery", label: "Community" },
  { id: "contact", label: "Experience" },
];

const megaMenuColumns = [
  {
    title: "인사말",
    items: ["회사연혁", "대외기관 인증", "Wonderland"],
  },
  {
    title: "MAP",
    items: ["Wonderland", "Wonder K", "Primo School", "Quest Academy"],
  },
  {
    title: "News",
    items: [],
  },
  {
    title: "학부모상담",
    items: ["가맹문의", "캠퍼스"],
  },
  {
    title: "Special Day",
    items: ["Wonderland E-School", "Library"],
  },
];

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeId, setActiveId] = useState("about");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setActiveId(id);
    setIsOpen(false);
  };

  const getButtonClass = (id: string) =>
    [
      "relative pb-1 text-base font-semibold transition",
      "hover:-translate-y-0.5 hover:text-orange-600",
      "after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full",
      "after:origin-left after:scale-x-0 after:bg-orange-500 after:transition",
      "hover:after:scale-x-100",
      activeId === id ? "text-orange-500 after:scale-x-100" : "text-zinc-900",
    ].join(" ");

  const panelVisible = hoveredId !== null;

  return (
    <nav
      className="fixed left-0 right-0 top-0 z-50 border-b border-black/5 bg-white"
      onMouseLeave={() => setHoveredId(null)}
    >
      <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Image
            src="/sc-wonderland-logo.png"
            alt="SC Wonderland logo"
            width={140}
            height={64}
            priority
          />
        </div>
        <div className="hidden items-center gap-12 md:flex">
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={getButtonClass(item.id)}
              onClick={() => scrollToSection(item.id)}
              onMouseEnter={() => setHoveredId(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-500 text-white"
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
        <div className="mx-auto flex w-full max-w-6xl justify-between gap-10 px-6 py-10 text-sm">
          {megaMenuColumns.map((column) => (
            <div key={column.title} className="min-w-[140px] space-y-3">
              <div className="text-base font-semibold">{column.title}</div>
              <ul className="space-y-2 text-white/85">
                {column.items.length === 0 ? (
                  <li className="text-white/50">준비중</li>
                ) : (
                  column.items.map((item) => (
                    <li key={item} className="transition hover:text-white">
                      {item}
                    </li>
                  ))
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-black/5 bg-white">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6 text-base font-semibold text-zinc-900 md:flex-row md:gap-10">
            {menuItems.map((item) => (
              <button
                key={item.id}
                className={getButtonClass(item.id)}
                onClick={() => scrollToSection(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

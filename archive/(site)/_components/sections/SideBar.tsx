"use client";

import Link from "next/link";
import { useState } from "react";

const quickLinks = [
  {
    title: "상담 신청",
    description: "배치·학습 상담",
    accentColor: "border-l-[#3a75ff] hover:bg-blue-50",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    href: "/community/parent-consultation",
    internal: true,
  },
  {
    title: "Links",
    description: "유용한 링크 모음",
    accentColor: "border-l-orange-500 hover:bg-orange-50",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    href: "/experience/links",
    internal: true,
  },
];

function QuickLinkCard({
  item,
  onClick,
}: {
  item: (typeof quickLinks)[0];
  onClick?: () => void;
}) {
  const cardClass = `
    group flex w-48 min-w-0 items-center gap-3 rounded-r-xl border-l-4 border-solid
    bg-white px-4 py-3.5 text-left shadow-sm ring-1 ring-gray-200/80
    transition-all duration-200 ${item.accentColor}
  `;
  const content = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition-colors group-hover:bg-gray-200">
        {item.icon}
      </span>
      <div className="min-w-0 flex-1">
        <span className="block break-keep text-sm font-semibold leading-snug text-gray-900">
          {item.title}
        </span>
        <span className="block break-keep text-xs leading-snug text-gray-500">
          {item.description}
        </span>
      </div>
      <svg
        className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </>
  );

  if (item.internal) {
    return (
      <Link href={item.href} onClick={onClick} className={cardClass}>
        {content}
      </Link>
    );
  }

  return (
    <a
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={cardClass}
    >
      {content}
    </a>
  );
}

export function SideBar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* PC: 기존 우측 고정 사이드바 */}
      <aside
        className="fixed right-6 top-1/2 z-40 hidden -translate-y-1/2 lg:block"
        aria-label="바로가기"
      >
        <div className="flex flex-col gap-3">
          <span className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            바로가기
          </span>
          {quickLinks.map((item) => (
            <QuickLinkCard key={item.title} item={item} />
          ))}
        </div>
      </aside>

      {/* 모바일: 플로팅 버튼 + 열면 퀵링크 패널 */}
      <div className="fixed bottom-6 right-6 z-40 lg:hidden" aria-label="바로가기">
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/20"
              aria-hidden
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute bottom-14 right-0 flex flex-col gap-2 rounded-xl bg-white p-3 shadow-lg ring-1 ring-gray-200/80">
              <span className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                바로가기
              </span>
              {quickLinks.map((item) => (
                <QuickLinkCard
                  key={item.title}
                  item={item}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
            </div>
          </>
        )}
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg transition hover:bg-orange-600"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "바로가기 닫기" : "바로가기 열기"}
        >
          {mobileOpen ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
          )}
        </button>
      </div>
    </>
  );
}

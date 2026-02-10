"use client";

import Link from "next/link";
import { useState } from "react";

const quickLinks = [
  {
    title: "학원 전용",
    description: "로그인 · 숙제 · 리포트",
    accentColor: "border-l-emerald-600 hover:bg-emerald-50",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    href: "/academy/dashboard",
    internal: true,
  },
  {
    title: "리포트 카드",
    description: "학습 성과 확인",
    accentColor: "border-l-[#e73357] hover:bg-red-50",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    href: "https://wonderland-reportcard.web.app",
    internal: false,
  },
  {
    title: "레벨테스트",
    description: "실력 평가",
    accentColor: "border-l-[#3a75ff] hover:bg-blue-50",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    href: "http://qawonderland.com/leveltest/",
    internal: false,
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          )}
        </button>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import { PageContent } from "@/app/(site)/_components/sections/PageContent";

export const metadata: Metadata = {
  title: "Links | 원더랜드 영어학원",
  description: "원더랜드 영어학원 유용한 링크 모음",
};

const links = [
  {
    title: "Children's Music",
    description: "Music with Nancy YouTube 채널",
    href: "https://www.youtube.com/@musicwithnancy/videos",
    color: "border-red-500 bg-red-50 hover:bg-red-100",
    iconColor: "text-red-600",
    icon: (
      <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  {
    title: "Miss Jolie Music",
    description: "Miss Jolie Music YouTube 채널",
    href: "https://www.youtube.com/c/MissJolieMusic/videos",
    color: "border-red-500 bg-red-50 hover:bg-red-100",
    iconColor: "text-red-600",
    icon: (
      <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  {
    title: "Creativity",
    description: "Creativity Facebook 페이지",
    href: "https://www.facebook.com/profile.php?id=61575547892633",
    color: "border-blue-600 bg-blue-50 hover:bg-blue-100",
    iconColor: "text-blue-600",
    icon: (
      <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    title: "Circle Time",
    description: "연간 커리큘럼",
    href: "/circle-time-curriculum.html",
    color: "border-violet-500 bg-violet-50 hover:bg-violet-100",
    iconColor: "text-violet-600",
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
  },
  {
    title: "Teaching Materials",
    description: "수업자료",
    href: "https://drive.google.com/drive/folders/1JSEPUjUkYrwmrq8SlOLbyEiCypSThyuo?usp=sharing",
    color: "border-yellow-500 bg-yellow-50 hover:bg-yellow-100",
    iconColor: "text-yellow-600",
    icon: (
      <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
        <path d="M7.71 3.5L1.15 15l3.43 5.96h6.58l3.43-5.96L8.03 3.5H7.71zm.79 1.72l5.27 9.14H3.23l5.27-9.14zm7.21-1.72L9.15 15l3.43 5.96h6.58L22.59 15l-6.56-11.5h-.32zm.79 1.72l5.27 9.14h-10.54l5.27-9.14z" />
      </svg>
    ),
  },
  {
    title: "CMS Kids",
    description: "CMS 에듀케이션 키즈",
    href: "https://cmskids.cmsedu.co.kr/",
    color: "border-emerald-500 bg-emerald-50 hover:bg-emerald-100",
    iconColor: "text-emerald-600",
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
];

export default function LinksPage() {
  return (
    <PageContent title="Links">
      <div className="not-prose grid gap-4 sm:grid-cols-2">
        {links.map((link) => (
          <a
            key={link.title}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-4 rounded-xl border-l-4 p-5 shadow-sm ring-1 ring-gray-200/80 transition-all duration-200 ${link.color}`}
          >
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ${link.iconColor}`}>
              {link.icon}
            </span>
            <div>
              <span className="block text-base font-semibold text-gray-900">
                {link.title}
              </span>
              <span className="block text-sm text-gray-600">
                {link.description}
              </span>
            </div>
            <svg
              className="ml-auto h-5 w-5 shrink-0 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        ))}
      </div>
    </PageContent>
  );
}

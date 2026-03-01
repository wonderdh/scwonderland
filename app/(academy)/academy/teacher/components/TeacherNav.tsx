"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS = {
  classes: (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
    </svg>
  ),
  reports: (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  ),
  textbooks: (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  notices: (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 0 8.835-2.535m0 0A23.74 23.74 0 0 0 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 0 0 1.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 0 1 0 3.46" />
    </svg>
  ),
  classManage: (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  ),
  homework: (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
  ),
  attendance: (
    <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
};

type LinkItem = {
  href: string;
  label: string;
  activeColor: string;
  icon: React.ReactNode;
};

const koreanLinks: LinkItem[] = [
  {
    href: "/academy/teacher",
    label: "담당 반",
    activeColor: "bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md",
    icon: ICONS.classes,
  },
  {
    href: "/academy/teacher/notices",
    label: "공지사항",
    activeColor: "bg-gradient-to-r from-yellow-500 to-amber-500 text-white shadow-md",
    icon: ICONS.notices,
  },
  {
    href: "/academy/teacher/classes",
    label: "반 관리",
    activeColor: "bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-md",
    icon: ICONS.classManage,
  },
  {
    href: "/academy/teacher/textbooks",
    label: "교재",
    activeColor: "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md",
    icon: ICONS.textbooks,
  },
  {
    href: "/academy/teacher/attendance",
    label: "출결",
    activeColor: "bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-md",
    icon: ICONS.attendance,
  },
  {
    href: "/academy/teacher/homework",
    label: "숙제",
    activeColor: "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md",
    icon: ICONS.homework,
  },
  {
    href: "/academy/teacher/bus",
    label: "승하차",
    activeColor: "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md",
    icon: (
      <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 17a2 2 0 100-4 2 2 0 000 4zm8 0a2 2 0 100-4 2 2 0 000 4zM6 3h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2zm0 4h12M7 21h2m6 0h2" />
      </svg>
    ),
  },
];

const nativeLinks: LinkItem[] = [
  {
    href: "/academy/teacher",
    label: "My Classes",
    activeColor: "bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md",
    icon: ICONS.classes,
  },
  {
    href: "/academy/teacher/reports",
    label: "Report Cards",
    activeColor: "bg-gradient-to-r from-yellow-500 to-amber-500 text-white shadow-md",
    icon: ICONS.reports,
  },
  {
    href: "/academy/teacher/textbooks",
    label: "Textbooks",
    activeColor: "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md",
    icon: ICONS.textbooks,
  },
  {
    href: "/academy/teacher/attendance",
    label: "Attendance",
    activeColor: "bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-md",
    icon: ICONS.attendance,
  },
  {
    href: "/academy/teacher/homework",
    label: "Homework",
    activeColor: "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md",
    icon: ICONS.homework,
  },
];

export function TeacherNav({ teacherType }: { teacherType: "korean" | "native" }) {
  const pathname = usePathname();
  const links = teacherType === "native" ? nativeLinks : koreanLinks;

  return (
    <nav className="mb-6 flex items-center gap-1 rounded-xl border bg-card p-1.5 shadow-sm">
      {links.map(({ href, label, icon, activeColor }) => {
        const isActive =
          href === "/academy/teacher"
            ? pathname === "/academy/teacher"
            : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-lg px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium transition-all ${
              isActive
                ? activeColor
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {icon}
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import { PortalNav, type PortalNavLink } from "../../_components/PortalNav";
import { User, FileText, Megaphone, SquarePen, BookOpen, CalendarDays, Bus } from "lucide-react";

const links: PortalNavLink[] = [
  {
    href: "/academy/student",
    label: "내 정보",
    activeColor: "bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md",
    icon: (
      <User className="size-4" strokeWidth={1.5} />
    ),
  },
  {
    href: "/academy/student/reports",
    label: "리포트카드",
    activeColor: "bg-gradient-to-r from-yellow-500 to-amber-500 text-white shadow-md",
    icon: (
      <FileText className="size-4" strokeWidth={1.5} />
    ),
  },
  {
    href: "/academy/student/notices",
    label: "공지",
    activeColor: "bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-md",
    icon: (
      <Megaphone className="size-4" strokeWidth={1.5} />
    ),
  },
  {
    href: "/academy/student/homework",
    label: "숙제",
    activeColor: "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md",
    icon: (
      <SquarePen className="size-4" strokeWidth={1.5} />
    ),
  },
  {
    href: "/academy/student/reading",
    label: "Raz 리딩",
    activeColor: "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md",
    icon: (
      <BookOpen className="size-4" strokeWidth={1.5} />
    ),
  },
  {
    href: "/academy/student/timetable",
    label: "시간표",
    activeColor: "bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md",
    icon: (
      <CalendarDays className="size-4" strokeWidth={1.5} />
    ),
  },
  {
    href: "/academy/student/bus",
    label: "승하차",
    activeColor: "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md",
    icon: (
      <Bus className="size-4" strokeWidth={1.5} />
    ),
  },
];

export function StudentNav() {
  return <PortalNav links={links} rootHref="/academy/student" />;
}

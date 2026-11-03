"use client";

import { PortalNav, type PortalNavLink } from "../../_components/PortalNav";
import { Users, FileText, BookOpen, Megaphone, Settings, SquarePen, CalendarDays, CircleCheck } from "lucide-react";

const ICONS = {
  classes: (
    <Users className="size-4" strokeWidth={1.5} />
  ),
  reports: (
    <FileText className="size-4" strokeWidth={1.5} />
  ),
  textbooks: (
    <BookOpen className="size-4" strokeWidth={1.5} />
  ),
  notices: (
    <Megaphone className="size-4" strokeWidth={1.5} />
  ),
  classManage: (
    <Settings className="size-4" strokeWidth={1.5} />
  ),
  homework: (
    <SquarePen className="size-4" strokeWidth={1.5} />
  ),
  timetable: (
    <CalendarDays className="size-4" strokeWidth={1.5} />
  ),
  attendance: (
    <CircleCheck className="size-4" strokeWidth={1.5} />
  ),
};

const koreanLinks: PortalNavLink[] = [
  {
    href: "/academy/teacher",
    label: "담당 반",
    activeColor: "bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md",
    icon: ICONS.classes,
  },
  {
    href: "/academy/teacher/timetable",
    label: "시간표",
    activeColor: "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md",
    icon: ICONS.timetable,
  },
  {
    href: "/academy/teacher/reports",
    label: "리포트카드",
    activeColor: "bg-gradient-to-r from-yellow-500 to-amber-500 text-white shadow-md",
    icon: ICONS.reports,
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
    href: "/academy/teacher/homework",
    label: "숙제",
    activeColor: "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md",
    icon: ICONS.homework,
  },
  {
    href: "/academy/teacher/reading",
    label: "Raz 리딩",
    activeColor: "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md",
    icon: ICONS.textbooks,
  },
  {
    href: "/academy/teacher/attendance",
    label: "출결",
    activeColor: "bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-md",
    icon: ICONS.attendance,
  },
];

const nativeLinks: PortalNavLink[] = [
  {
    href: "/academy/teacher",
    label: "My Classes",
    activeColor: "bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md",
    icon: ICONS.classes,
  },
  {
    href: "/academy/teacher/timetable",
    label: "Timetable",
    activeColor: "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md",
    icon: ICONS.timetable,
  },
  {
    href: "/academy/teacher/reports",
    label: "Report Cards",
    activeColor: "bg-gradient-to-r from-yellow-500 to-amber-500 text-white shadow-md",
    icon: ICONS.reports,
  },
  {
    href: "/academy/teacher/homework",
    label: "Homework",
    activeColor: "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md",
    icon: ICONS.homework,
  },
  {
    href: "/academy/teacher/reading",
    label: "Raz Reading",
    activeColor: "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md",
    icon: ICONS.textbooks,
  },
  {
    href: "/academy/teacher/attendance",
    label: "Attendance",
    activeColor: "bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-md",
    icon: ICONS.attendance,
  },
];

export function TeacherNav({
  teacherType,
  teacherName,
}: {
  teacherType: "korean" | "native";
  teacherName?: string;
}) {
  const links = teacherType === "native" ? nativeLinks : koreanLinks;
  return (
    <PortalNav links={links} rootHref="/academy/teacher" badge={teacherName} />
  );
}

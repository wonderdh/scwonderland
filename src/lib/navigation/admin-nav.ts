export type AdminNavItem = {
  href: string;
  label: string;
  icon: "home" | "users" | "graduation-cap" | "school" | "book" | "bell" | "megaphone" | "calendar" | "bus" | "clipboard-check" | "calendar-days" | "file-text" | "sparkles" | "school-2";
};

export type AdminNavGroup = {
  title: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    title: "대시보드",
    items: [
      { href: "/admin", label: "대시보드", icon: "home" },
    ],
  },
  {
    title: "사람",
    items: [
      { href: "/admin/students", label: "학생 관리", icon: "users" },
      { href: "/admin/teachers", label: "교사 관리", icon: "graduation-cap" },
      { href: "/admin/classes", label: "반 관리", icon: "school" },
      { href: "/admin/afterschool", label: "방과후", icon: "school-2" },
    ],
  },
  {
    title: "수업",
    items: [
      { href: "/admin/homework", label: "숙제", icon: "book" },
      { href: "/admin/timetable", label: "시간표", icon: "calendar" },
      { href: "/admin/weekly-sentences", label: "주간 문장", icon: "sparkles" },
    ],
  },
  {
    title: "일일 운영",
    items: [
      { href: "/admin/attendance", label: "출결", icon: "clipboard-check" },
      { href: "/admin/bus", label: "승하차", icon: "bus" },
      { href: "/admin/reservations", label: "예약 현황", icon: "calendar-days" },
      { href: "/admin/reports", label: "리포트카드", icon: "file-text" },
    ],
  },
  {
    title: "공지",
    items: [
      { href: "/admin/notices", label: "공개 공지", icon: "bell" },
    ],
  },
];

export function getBreadcrumbForPath(pathname: string): { label: string; href?: string }[] {
  const items: { label: string; href?: string }[] = [{ label: "관리자", href: "/admin" }];
  if (pathname === "/admin" || pathname === "/admin/") return items;
  for (const group of ADMIN_NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(item.href + "/")) {
        items.push({ label: item.label, href: item.href });
        return items;
      }
    }
  }
  return items;
}

import Link from "next/link";
import { getDashboardStats } from "./actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  const statCards = [
    {
      label: "학생",
      value: stats.studentCount,
      icon: (
        <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
        </svg>
      ),
      gradient: "from-emerald-500 to-teal-600",
    },
    {
      label: "교사",
      value: stats.teacherCount,
      icon: (
        <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a23.838 23.838 0 0 0-1.012 5.434c1.073.116 2.16.194 3.26.231m7.745-5.665a23.827 23.827 0 0 0 5.501 0m-5.501 0L12 2.25l-3.489 7.897Z" />
        </svg>
      ),
      gradient: "from-blue-500 to-indigo-600",
    },
    {
      label: "반",
      value: stats.classCount,
      icon: (
        <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
        </svg>
      ),
      gradient: "from-violet-500 to-purple-600",
    },
    {
      label: "리포트카드",
      value: stats.reportCardCount,
      icon: (
        <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      ),
      gradient: "from-amber-500 to-orange-600",
    },
  ];

  const navCards = [
    {
      href: "/admin/students",
      title: "학생 관리",
      description: "학생 목록 조회, 추가, 수정, 삭제",
      badge: `${stats.studentCount}명`,
      borderColor: "hover:border-emerald-300",
      badgeColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
      iconColor: "text-emerald-600",
    },
    {
      href: "/admin/teachers",
      title: "교사 관리",
      description: "교사 목록 조회, 추가, 수정, 삭제",
      badge: `${stats.teacherCount}명`,
      borderColor: "hover:border-blue-300",
      badgeColor: "bg-blue-100 text-blue-700 border-blue-200",
      iconColor: "text-blue-600",
    },
    {
      href: "/admin/classes",
      title: "반 관리",
      description: "반 생성, 담당 교사 지정, 학생 배정",
      badge: `${stats.classCount}개`,
      borderColor: "hover:border-violet-300",
      badgeColor: "bg-violet-100 text-violet-700 border-violet-200",
      iconColor: "text-violet-600",
    },
    {
      href: "/admin/textbooks",
      title: "교재 관리",
      description: "교재 등록, 반/학생 배정, 진도 관리",
      badge: null,
      borderColor: "hover:border-amber-300",
      badgeColor: "",
      iconColor: "text-amber-600",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">대시보드</h1>
        <p className="text-muted-foreground text-sm mt-1">
          원더랜드 영어학원 관리 시스템
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label} className="py-4 gap-3 overflow-hidden relative">
            <CardContent className="flex items-center gap-4">
              <div className={`rounded-xl p-2.5 bg-gradient-to-br ${s.gradient} text-white shadow-md`}>
                {s.icon}
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">{s.value}</p>
                <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">관리</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {navCards.map((item) => (
            <Link key={item.href} href={item.href} className="group">
              <Card className={`py-5 transition-all hover:shadow-lg ${item.borderColor}`}>
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{item.title}</CardTitle>
                    {item.badge && (
                      <Badge variant="outline" className={item.badgeColor}>
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className={`text-sm ${item.iconColor} group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1 font-medium`}>
                    관리 페이지로 이동
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

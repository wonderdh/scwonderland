import Link from "next/link";
import { getDashboardStats, getTodayStats, listAdmins } from "./actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DailyBusChanges } from "@/components/bus/DailyBusChanges";

export default async function AdminDashboardPage() {
  const [stats, todayStats, admins] = await Promise.all([getDashboardStats(), getTodayStats(), listAdmins()]);

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
    {
      label: "공지사항",
      value: stats.noticeCount,
      icon: (
        <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 0 8.835-2.535m0 0A23.74 23.74 0 0 0 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 0 0 1.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 0 1 0 3.46" />
        </svg>
      ),
      gradient: "from-rose-500 to-pink-600",
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
    {
      href: "/admin/notices",
      title: "공지사항 관리",
      description: "공지사항 작성, 이미지/파일 첨부",
      badge: `${stats.noticeCount}건`,
      borderColor: "hover:border-rose-300",
      badgeColor: "bg-rose-100 text-rose-700 border-rose-200",
      iconColor: "text-rose-600",
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

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
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
        <h2 className="text-lg font-semibold mb-4">오늘의 현황</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/admin/bus?tab=changes">
            <Card className="py-4 transition-all hover:shadow-md hover:border-orange-300 cursor-pointer">
              <CardContent className="flex items-center gap-4">
                <div className="rounded-xl p-2.5 bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-md">
                  <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 17a2 2 0 100-4 2 2 0 000 4zm8 0a2 2 0 100-4 2 2 0 000 4zM6 3h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2zm0 4h12M7 21h2m6 0h2" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold tracking-tight">
                    {todayStats.pendingBusChangeCount}
                    {todayStats.pendingBusChangeCount > 0 && (
                      <span className="ml-2 text-sm font-normal text-orange-500">처리 필요</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground font-medium">미처리 버스 변경 요청</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/students">
            <Card className="py-4 transition-all hover:shadow-md hover:border-teal-300 cursor-pointer">
              <CardContent className="flex items-center gap-4">
                <div className="rounded-xl p-2.5 bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-md">
                  <svg className="size-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">{todayStats.todayAttendanceCount}</p>
                  <p className="text-xs text-muted-foreground font-medium">오늘 출결 기록</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
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

      <div className="grid gap-8 lg:grid-cols-2">
        <DailyBusChanges />

        <div>
          <h2 className="text-lg font-semibold mb-4">관리자 계정</h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {admins.map((admin) => (
                  <div key={admin.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="size-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-medium text-slate-600">
                      {(admin.name || "A").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{admin.name}</p>
                      <p className="text-xs text-muted-foreground">{admin.email.split("@")[0]}</p>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {new Date(admin.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                ))}
                {admins.length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">관리자 계정이 없습니다.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

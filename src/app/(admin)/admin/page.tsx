import Link from "next/link";
import {
  Users,
  GraduationCap,
  BookOpen,
  FileText,
  Megaphone,
  Bus,
  CheckCircle2,
} from "lucide-react";
import {
  getDashboardStats,
  getTodayStats,
} from "@/app/(admin)/admin/actions/dashboard-actions";
import {
  listAdmins,
} from "@/app/(admin)/admin/actions/user-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DailyBusChanges } from "@/components/bus/DailyBusChanges";
import { PageHeader } from "@/components/navigation/PageHeader";

export default async function AdminDashboardPage() {
  const [stats, todayStats, admins] = await Promise.all([getDashboardStats(), getTodayStats(), listAdmins()]);

  const statCards = [
    {
      label: "학생",
      value: stats.studentCount,
      Icon: Users,
      gradient: "from-emerald-500 to-teal-600",
    },
    {
      label: "교사",
      value: stats.teacherCount,
      Icon: GraduationCap,
      gradient: "from-blue-500 to-indigo-600",
    },
    {
      label: "반",
      value: stats.classCount,
      Icon: Users,
      gradient: "from-violet-500 to-purple-600",
    },
    {
      label: "리포트카드",
      value: stats.reportCardCount,
      Icon: FileText,
      gradient: "from-amber-500 to-orange-600",
    },
    {
      label: "공지사항",
      value: stats.noticeCount,
      Icon: Megaphone,
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
      Icon: Users,
    },
    {
      href: "/admin/teachers",
      title: "교사 관리",
      description: "교사 목록 조회, 추가, 수정, 삭제",
      badge: `${stats.teacherCount}명`,
      borderColor: "hover:border-blue-300",
      badgeColor: "bg-blue-100 text-blue-700 border-blue-200",
      iconColor: "text-blue-600",
      Icon: GraduationCap,
    },
    {
      href: "/admin/classes",
      title: "반 관리",
      description: "반 생성, 담당 교사 지정, 학생 배정",
      badge: `${stats.classCount}개`,
      borderColor: "hover:border-violet-300",
      badgeColor: "bg-violet-100 text-violet-700 border-violet-200",
      iconColor: "text-violet-600",
      Icon: Users,
    },
    {
      href: "/admin/homework",
      title: "숙제 관리",
      description: "숙제 등록, 반/학생 배정, 진도 관리",
      badge: null,
      borderColor: "hover:border-amber-300",
      badgeColor: "",
      iconColor: "text-amber-600",
      Icon: BookOpen,
    },
    {
      href: "/admin/notices",
      title: "공지사항 관리",
      description: "공지사항 작성, 이미지/파일 첨부",
      badge: `${stats.noticeCount}건`,
      borderColor: "hover:border-rose-300",
      badgeColor: "bg-rose-100 text-rose-700 border-rose-200",
      iconColor: "text-rose-600",
      Icon: Megaphone,
    },
    {
      href: "/admin/bus",
      title: "승하차 관리",
      description: "호차, 일일 매니페스트, 변경요청",
      badge: null,
      borderColor: "hover:border-orange-300",
      badgeColor: "",
      iconColor: "text-orange-600",
      Icon: Bus,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="관리자 대시보드"
        description="오늘의 학원 운영 현황을 한눈에 확인하세요."
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        {statCards.map(({ label, value, Icon, gradient }) => (
          <Card key={label} className="py-4 gap-3 overflow-hidden relative">
            <CardContent className="flex items-center gap-4">
              <div className={`rounded-xl p-3 bg-gradient-to-br ${gradient} text-white shadow-md`}>
                <Icon className="h-7 w-7" aria-hidden="true" />
              </div>
              <div>
                <p className="text-4xl font-bold tracking-tight">{value}</p>
                <p className="text-base text-muted-foreground font-medium">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">오늘의 현황</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/admin/bus?tab=changes">
            <Card className="py-4 transition-all hover:shadow-lg hover:-translate-y-0.5 hover:border-orange-300 cursor-pointer">
              <CardContent className="flex items-center gap-4">
                <div className="rounded-xl p-3 bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-md">
                  <Bus className="h-7 w-7" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <p className="text-4xl font-bold tracking-tight">
                    {todayStats.pendingBusChangeCount}
                    {todayStats.pendingBusChangeCount > 0 && (
                      <span className="ml-2 text-base font-normal text-orange-500">처리 필요</span>
                    )}
                  </p>
                  <p className="text-base text-muted-foreground font-medium">미처리 버스 변경 요청</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/students">
            <Card className="py-4 transition-all hover:shadow-lg hover:-translate-y-0.5 hover:border-teal-300 cursor-pointer">
              <CardContent className="flex items-center gap-4">
                <div className="rounded-xl p-3 bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-md">
                  <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-4xl font-bold tracking-tight">{todayStats.todayAttendanceCount}</p>
                  <p className="text-base text-muted-foreground font-medium">오늘 출결 기록</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">관리</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {navCards.map((item) => (
            <Link key={item.href} href={item.href} className="group">
              <Card
                className={`h-32 py-0 transition-all hover:shadow-lg hover:-translate-y-0.5 ${item.borderColor}`}
              >
                <CardHeader className="pb-0 pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <item.Icon className={`h-7 w-7 shrink-0 ${item.iconColor}`} aria-hidden="true" />
                      <CardTitle className="text-xl truncate">{item.title}</CardTitle>
                    </div>
                    {item.badge && (
                      <Badge variant="outline" className={`${item.badgeColor} text-sm shrink-0`}>
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-sm mt-1">{item.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <DailyBusChanges />

        <div>
          <h2 className="text-xl font-semibold mb-4">관리자 계정</h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {admins.map((admin) => (
                  <div key={admin.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="size-9 rounded-full bg-slate-100 flex items-center justify-center text-base font-medium text-slate-600">
                      {(admin.name || "A").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-medium text-foreground">{admin.name}</p>
                      <p className="text-sm text-muted-foreground">{admin.email.split("@")[0]}</p>
                    </div>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {new Date(admin.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                ))}
                {admins.length === 0 && (
                  <p className="text-base text-muted-foreground py-6 text-center">관리자 계정이 없습니다.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

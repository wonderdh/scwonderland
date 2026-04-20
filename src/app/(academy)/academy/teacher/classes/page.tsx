import { getCurrentTeacherProfile, getTeacherClasses } from "../../actions";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function TeacherClassesPage() {
  const profile = await getCurrentTeacherProfile();
  if (profile?.teacher_type === "native") {
    redirect("/academy/teacher");
  }

  const classes = await getTeacherClasses();

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">반 관리</h1>

      {classes.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">담당 반이 없습니다.</p>
            <p className="mt-1 text-xs text-muted-foreground">관리자에게 반 배정을 요청하세요.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {classes.map((cls) => (
            <Card key={cls.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{cls.name}</CardTitle>
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                    {cls.students.length}명
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {cls.students.length === 0 ? (
                  <p className="text-sm text-muted-foreground">등록된 학생이 없습니다.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {cls.students.map((s) => (
                      <li
                        key={s.profile_id}
                        className="flex items-center justify-between text-sm rounded-md px-3 py-1.5 bg-gradient-to-r from-muted/80 to-transparent"
                      >
                        <span className="font-medium">
                          {s.korean_name ?? "—"}
                          {s.english_name && (
                            <span className="text-muted-foreground font-normal ml-1">
                              ({s.english_name})
                            </span>
                          )}
                        </span>
                        {s.student_number && (
                          <span className="text-xs font-mono text-muted-foreground">
                            {s.student_number}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

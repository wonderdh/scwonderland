import { getCurrentStudentClasses, getCurrentStudentProfile } from "../actions";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function StudentInfoPage() {
  const [profile, classes] = await Promise.all([
    getCurrentStudentProfile(),
    getCurrentStudentClasses(),
  ]);
  if (!profile) return null;

  return (
    <div className="space-y-6">
      {/* 프로필 카드 */}
      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-red-500 via-yellow-400 via-green-500 to-blue-500" />
        <CardContent className="-mt-10 pb-6">
          <div className="flex items-end gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-white text-orange-600 text-2xl font-bold shadow-lg ring-4 ring-white">
              {(profile.korean_name ?? "?")[0]}
            </div>
            <div className="pb-1 min-w-0">
              <h1 className="text-xl font-bold leading-snug">
                {profile.korean_name ?? "—"}
                {profile.english_name && (
                  <span className="text-muted-foreground font-normal text-base ml-2 whitespace-nowrap">
                    ({profile.english_name})
                  </span>
                )}
              </h1>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 소속 반 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <svg className="size-5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
            소속 반
          </CardTitle>
        </CardHeader>
        <CardContent>
          {classes.length === 0 ? (
            <p className="text-sm text-muted-foreground">소속된 반이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {classes.map((item, i) => (
                <div
                  key={`${item.class_name}-${i}`}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-green-100 bg-gradient-to-r from-green-50/80 to-transparent px-4 py-3"
                >
                  <span className="font-medium flex-1 min-w-0 truncate">{item.class_name}</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.teachers.length === 0 ? (
                      <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 whitespace-nowrap">
                        담당: 미지정
                      </Badge>
                    ) : (
                      item.teachers.map((t, ti) => (
                        <Badge
                          key={ti}
                          variant="outline"
                          className={`whitespace-nowrap ${
                            t.teacher_type === "native"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {t.name ?? "—"} ({t.teacher_type === "native" ? "원어민" : "한국인"})
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        정보 수정이 필요하면 선생님 또는 관리자에게 문의하세요.
      </p>
    </div>
  );
}

import { getCurrentStudentTextbooks } from "../../actions";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_MAP = {
  not_started: { label: "시작 전", variant: "secondary" as const },
  in_progress: { label: "진행 중", variant: "default" as const },
  completed: { label: "완료", variant: "outline" as const },
} as const;

const CATEGORY_MAP: Record<string, string> = {
  general: "일반",
  phonics: "파닉스",
  reading: "읽기",
  grammar: "문법",
  speaking: "말하기",
  writing: "쓰기",
  vocabulary: "어휘",
};

export default async function StudentTextbooksPage() {
  const textbooks = await getCurrentStudentTextbooks();

  const completed = textbooks.filter((t) => t.status === "completed").length;
  const inProgress = textbooks.filter((t) => t.status === "in_progress").length;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold tracking-tight">내 교재</h1>

      {textbooks.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="py-3 gap-0 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
            <CardContent className="text-center">
              <p className="text-2xl font-bold text-violet-700">{textbooks.length}</p>
              <p className="text-xs text-violet-600 font-medium">전체</p>
            </CardContent>
          </Card>
          <Card className="py-3 gap-0 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
            <CardContent className="text-center">
              <p className="text-2xl font-bold text-blue-700">{inProgress}</p>
              <p className="text-xs text-blue-600 font-medium">진행 중</p>
            </CardContent>
          </Card>
          <Card className="py-3 gap-0 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <CardContent className="text-center">
              <p className="text-2xl font-bold text-emerald-700">{completed}</p>
              <p className="text-xs text-emerald-600 font-medium">완료</p>
            </CardContent>
          </Card>
        </div>
      )}

      {textbooks.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center text-sm text-muted-foreground">
            배정된 교재가 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {textbooks.map((t) => {
            const pct = t.total_units > 0 ? Math.round((t.completed_units / t.total_units) * 100) : 0;
            const st = STATUS_MAP[t.status];

            return (
              <Card key={t.id} className="py-4 gap-3">
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{t.textbook_title}</h3>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-700 border-violet-200">
                          {CATEGORY_MAP[t.textbook_category] ?? t.textbook_category}
                        </Badge>
                        {t.textbook_level && (
                          <span className="text-xs text-muted-foreground">Lv. {t.textbook_level}</span>
                        )}
                        {t.source_type === "class" && (
                          <span className="text-xs text-muted-foreground">
                            반: {t.source_class_name ?? ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={st.variant}
                      className={
                        t.status === "completed"
                          ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                          : t.status === "in_progress"
                            ? "bg-blue-600 text-white"
                            : ""
                      }
                    >
                      {st.label}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 100
                            ? "bg-gradient-to-r from-emerald-400 to-emerald-600"
                            : "bg-gradient-to-r from-blue-400 to-indigo-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground shrink-0">
                      {t.completed_units}/{t.total_units} ({pct}%)
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

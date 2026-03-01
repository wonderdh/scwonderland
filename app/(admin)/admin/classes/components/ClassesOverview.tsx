"use client";

import type { ClassWithDetails, ClassTeacherInfo } from "@/lib/types";

type FlatClassStudent = {
  class_id: string;
  id: string;
  student_profile_id: string;
  korean_name: string | null;
  english_name: string | null;
  student_number: string | null;
};

function TeacherBadges({ teachers }: { teachers: ClassTeacherInfo[] }) {
  if (teachers.length === 0)
    return <span className="text-muted-foreground">미지정</span>;
  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {teachers.map((t) => (
        <span
          key={t.profile_id}
          className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
            t.teacher_type === "native"
              ? "bg-blue-100 text-blue-700"
              : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {t.name ?? "—"}
        </span>
      ))}
    </span>
  );
}

export function ClassesOverview({
  classes,
  allClassStudents,
}: {
  classes: ClassWithDetails[];
  allClassStudents: FlatClassStudent[];
}) {
  if (classes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-slate-50/50 p-8 text-center text-sm text-muted-foreground">
        등록된 반이 없습니다.
      </div>
    );
  }

  // 반별 학생 맵
  const studentsByClass = new Map<string, FlatClassStudent[]>();
  for (const s of allClassStudents) {
    const list = studentsByClass.get(s.class_id);
    if (list) list.push(s);
    else studentsByClass.set(s.class_id, [s]);
  }

  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
      {classes.map((c) => {
        const students = studentsByClass.get(c.id) ?? [];
        return (
          <div
            key={c.id}
            className="break-inside-avoid rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-foreground">{c.name}</h3>
              <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                {c.student_count}명
              </span>
            </div>
            <div className="text-xs text-muted-foreground mb-3">
              <span className="mr-1">담당:</span>
              <TeacherBadges teachers={c.teachers} />
            </div>
            {students.length > 0 && (
              <div className="border-t pt-2 space-y-0.5">
                {students.map((s) => (
                  <div
                    key={s.id}
                    className="text-xs text-foreground/80 flex items-center gap-2 overflow-hidden"
                  >
                    <span className="text-muted-foreground shrink-0">
                      {s.student_number ?? "—"}
                    </span>
                    <span className="truncate">
                      {s.korean_name ?? s.english_name ?? "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

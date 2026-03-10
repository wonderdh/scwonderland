"use client";

import { useEffect, useState } from "react";
import { getStudentClasses } from "../../actions";
import type { AdminStudentClassItem } from "@/lib/types";
import { LoadingState } from "@/components/LoadingState";

export function StudentClassesView({
  studentProfileId,
}: {
  studentProfileId: string;
}) {
  const [classes, setClasses] = useState<AdminStudentClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getStudentClasses(studentProfileId).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
      } else {
        setClasses(result.classes);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [studentProfileId]);

  if (loading) {
    return <LoadingState className="py-6" />;
  }

  if (error) {
    return (
      <div className="py-6 text-center text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
        {error}
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-slate-400">
        소속된 반이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">소속 반</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {classes.map((cls) => (
          <div
            key={cls.id}
            className="rounded-lg border border-slate-200 bg-slate-50/50 p-4"
          >
            <p className="font-medium text-foreground">{cls.name}</p>
            {cls.teachers.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {cls.teachers.map((teacher, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
                  >
                    <span>{teacher.name ?? "—"}</span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        teacher.teacher_type === "native"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {teacher.teacher_type === "native" ? "원어민" : "한국인"}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-400">담당 교사 없음</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

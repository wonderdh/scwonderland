"use client";

import {
  getClassWithStudents,
} from "@/app/(admin)/admin/actions/class-actions";
import type { ClassWithDetails, ClassStudentRow } from "@/lib/types";
import { useCallback, useEffect, useState } from "react";
import { LoadingState } from "@/components/feedback/LoadingState";
import { TeacherBadges } from "@/components/badges/TeacherBadges";
import { GROUP_ORDER, GROUP_TYPE_TO_LABEL, type GroupKey } from "@/lib/constants/class";
import { ChevronRight } from "lucide-react";

const GROUP_STYLE: Record<GroupKey, { icon: string; label: string; headerBg: string; headerText: string }> = {
  유치부: { icon: "🌅", label: "유치부", headerBg: "bg-amber-100", headerText: "text-amber-800" },
  오후반: { icon: "☁️", label: "오후반",  headerBg: "bg-sky-100",   headerText: "text-sky-800" },
  "":    { icon: "📋", label: "미지정", headerBg: "bg-slate-100", headerText: "text-slate-600" },
};

export function TeacherClassesTab({
  teacherProfileId,
  classes,
}: {
  teacherProfileId: string;
  classes: ClassWithDetails[];
}) {
  const myClasses = classes.filter((c) =>
    c.teachers.some((t) => t.profile_id === teacherProfileId)
  );

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const nonAfterschool = myClasses.filter((c) => GROUP_TYPE_TO_LABEL[c.group_type ?? ""] !== "방과후");
  const grouped = GROUP_ORDER.reduce<Record<GroupKey, ClassWithDetails[]>>(
    (acc, g) => {
      acc[g] = nonAfterschool.filter((c) => (GROUP_TYPE_TO_LABEL[c.group_type ?? ""] ?? "") === g);
      return acc;
    },
    { 유치부: [], 오후반: [], "": [] }
  );
  const activeGroups = GROUP_ORDER.filter((g) => grouped[g].length > 0);

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold text-foreground mb-4">
        담당 반
        {myClasses.length > 0 && (
          <span className="ml-2 text-sm font-normal text-muted-foreground">({myClasses.length}개)</span>
        )}
      </h2>
      {myClasses.length === 0 ? (
        <div className="rounded-xl border bg-muted/30 p-6 text-center text-muted-foreground text-sm">
          담당 반이 없습니다.
        </div>
      ) : (
        <div className="space-y-5">
          {activeGroups.map((group) => {
            const style = GROUP_STYLE[group];
            return (
              <div key={group}>
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 mb-2 ${style.headerBg}`}>
                  <span className="text-sm">{style.icon}</span>
                  <span className={`text-sm font-semibold ${style.headerText}`}>{style.label}</span>
                  <span className={`ml-auto text-xs font-medium ${style.headerText} opacity-70`}>
                    {grouped[group].length}개 반
                  </span>
                </div>
                <div className="space-y-2">
                  {grouped[group].map((c) => (
                    <ClassRow
                      key={c.id}
                      cls={c}
                      currentTeacherId={teacherProfileId}
                      isExpanded={expandedId === c.id}
                      onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClassRow({
  cls,
  currentTeacherId,
  isExpanded,
  onToggle,
}: {
  cls: ClassWithDetails;
  currentTeacherId: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [students, setStudents] = useState<ClassStudentRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadData = useCallback(async () => {
    const classData = await getClassWithStudents(cls.id);
    setStudents(classData.students);
    setLoaded(true);
  }, [cls.id]);

  useEffect(() => {
    if (isExpanded && !loaded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData();
    }
  }, [isExpanded, loaded, loadData]);

  return (
    <div
      className={`rounded-xl border bg-white overflow-hidden transition-all ${
        isExpanded ? "border-primary/40 shadow-sm" : "border-slate-200"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3 hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
            <span className="font-medium text-foreground">{cls.name}</span>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
              {cls.student_count}명
            </span>
          </div>
          <TeacherBadges teachers={cls.teachers} excludeTeacherId={currentTeacherId} prefixLabel="공동:" />
        </div>
      </button>

      {isExpanded && (
        <div className="border-t px-4 py-3 space-y-4">
          {!loaded ? (
            <LoadingState label="반 정보 불러오는 중..." className="py-4" />
          ) : (
            <>
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">담당 선생님</h4>
                <div className="flex flex-wrap gap-1.5">
                  {cls.teachers.map((t) => (
                    <span
                      key={t.profile_id}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium ${
                        t.teacher_type === "native"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      } ${t.profile_id === currentTeacherId ? "ring-1 ring-primary/40" : ""}`}
                    >
                      {t.name ?? "—"}
                      <span className="text-xs opacity-70">
                        ({t.teacher_type === "native" ? "원어민" : "한국인"})
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  학생 목록 ({students.length}명)
                </h4>
                {students.length === 0 ? (
                  <p className="text-xs text-muted-foreground">소속 학생이 없습니다.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {students.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 bg-slate-50 text-sm"
                      >
                        <span className="text-foreground">
                          {[s.korean_name, s.english_name].filter(Boolean).join(" / ") || "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

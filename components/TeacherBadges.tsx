import type { ClassTeacherInfo } from "@/lib/types";

/**
 * 담당 교사 배지 목록.
 * excludeTeacherId: 해당 교사를 목록에서 제외 (교사 본인 뷰에서 공동 교사만 표시할 때 사용)
 * prefixLabel: 배지 앞에 표시할 레이블 (예: "공동:")
 */
export function TeacherBadges({
  teachers,
  excludeTeacherId,
  prefixLabel,
}: {
  teachers: ClassTeacherInfo[];
  excludeTeacherId?: string;
  prefixLabel?: string;
}) {
  const visible = excludeTeacherId
    ? teachers.filter((t) => t.profile_id !== excludeTeacherId)
    : teachers;

  if (visible.length === 0) {
    return excludeTeacherId ? null : (
      <span className="text-muted-foreground">미지정</span>
    );
  }

  const badges = visible.map((t) => (
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
  ));

  if (prefixLabel) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">{prefixLabel}</span>
        {badges}
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {badges}
    </span>
  );
}

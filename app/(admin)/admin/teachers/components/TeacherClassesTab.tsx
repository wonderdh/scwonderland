"use client";

export function TeacherClassesTab({ teacherProfileId }: { teacherProfileId: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold text-foreground mb-2">담당 반</h2>
      <p className="text-muted-foreground text-sm mb-4">
        이 선생님이 담당하는 반 목록입니다. 반 배정 기능 연동 후 여기에 표시됩니다.
      </p>
      <div className="rounded-xl border bg-muted/30 p-6 text-center text-muted-foreground text-sm">
        담당 반이 없거나, 반 정보를 불러올 수 없습니다.
      </div>
    </div>
  );
}

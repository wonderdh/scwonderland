"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/feedback/Spinner";
import { toastError, toastSuccess } from "@/lib/ui/toast";
import { setClassLunchGroup } from "@/app/(admin)/admin/actions";
import type { LunchGroupClass } from "@/app/(admin)/admin/actions/lunch-actions";
import type { LunchGroup } from "@/lib/lunch/rotation";

const GROUP_OPTIONS: Array<{ value: LunchGroup | null; label: string; badge: string }> = [
  { value: null, label: "해당 없음", badge: "bg-slate-100 text-slate-500" },
  { value: "7세", label: "7세반", badge: "bg-amber-100 text-amber-700" },
  { value: "6세", label: "6세반", badge: "bg-sky-100 text-sky-700" },
];

export function LunchSettingsClient({ classes }: { classes: LunchGroupClass[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const age7Count = classes.filter((c) => c.lunch_group === "7세").length;
  const age6Count = classes.filter((c) => c.lunch_group === "6세").length;
  const ready = age7Count === 2 && age6Count === 2;

  const handleChange = (classId: string, group: LunchGroup | null) => {
    startTransition(async () => {
      const r = await setClassLunchGroup(classId, group);
      if (r.error) toastError(r.error);
      else {
        toastSuccess("저장되었습니다.");
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      <div
        className={`rounded-xl border px-4 py-3 text-sm ${
          ready
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-amber-200 bg-amber-50 text-amber-800"
        }`}
      >
        {ready ? (
          <>✅ 세팅 완료 — 7세반 {age7Count}개, 6세반 {age6Count}개</>
        ) : (
          <>
            ⚠️ 7세반 2개 + 6세반 2개 필요 — 현재 7세 {age7Count}개, 6세 {age6Count}개
          </>
        )}
      </div>

      {classes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
          유치부 반이 없습니다. 먼저 <b>반 관리</b>에서 유치부 반을 생성해주세요.
        </div>
      ) : (
        <ul className="space-y-2">
          {classes.map((cls) => (
            <li
              key={cls.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-slate-800 truncate">
                    {cls.name}
                  </p>
                  <p className="text-xs text-slate-500">학생 {cls.student_count}명</p>
                </div>
                {pending && <Spinner size="sm" />}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {GROUP_OPTIONS.map((opt) => {
                  const active = cls.lunch_group === opt.value;
                  return (
                    <Button
                      key={opt.label}
                      type="button"
                      variant={active ? "default" : "outline"}
                      size="sm"
                      disabled={pending}
                      onClick={() => handleChange(cls.id, opt.value)}
                      className={active ? "" : "border-slate-200"}
                    >
                      {opt.label}
                    </Button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

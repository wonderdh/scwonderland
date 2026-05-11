"use client";

import { useEffect, useState, useTransition, startTransition as reactStartTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  listClassUnitProgressDetailed,
  markUnit,
} from "@/app/(admin)/admin/actions";
import type {
  ClassUnitProgressDetailed,
  UnitStatus,
} from "@/app/(admin)/admin/actions";
import { ClassUnitProgressList } from "@/components/homework/ClassUnitProgressList";

type ClassOption = { id: string; name: string };

type Props = {
  classes: ClassOption[];
  initialClassId: string | null;
  initialData: ClassUnitProgressDetailed;
};

export function HomeworkCheckTab({
  classes,
  initialClassId,
  initialData,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(
    initialClassId
  );
  const [data, setData] = useState<ClassUnitProgressDetailed>(initialData);
  const [isPending, startTransition] = useTransition();

  function handleClassChange(classId: string) {
    setSelectedClassId(classId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "check");
    params.set("class", classId);
    router.replace(`/admin/homework?${params.toString()}`, { scroll: false });
    startTransition(async () => {
      const next = await listClassUnitProgressDetailed(classId);
      setData(next);
    });
  }

  // initialClassId 가 외부에서 바뀌어도 한 번 동기화
  useEffect(() => {
    if (initialClassId === selectedClassId) return;
    reactStartTransition(() => {
      setSelectedClassId(initialClassId);
      setData(initialData);
    });
  }, [initialClassId, selectedClassId, initialData]);

  async function reloadCurrentClass() {
    if (!selectedClassId) return;
    const next = await listClassUnitProgressDetailed(selectedClassId);
    setData(next);
  }

  async function handleMarkUnit(
    studentId: string,
    textbookId: string,
    unitNumber: number,
    nextStatus: UnitStatus
  ) {
    const fd = new FormData();
    fd.set("studentId", studentId);
    fd.set("textbookId", textbookId);
    fd.set("unitNumber", String(unitNumber));
    fd.set("status", nextStatus);
    const result = await markUnit(fd);
    if (result.error) {
      toast.error(result.error);
      await reloadCurrentClass();
      throw new Error(result.error);
    }
    // 성공 시: surgical state update (전체 재조회 X)
    setData((prev) => {
      const list = prev.byStudent[studentId];
      if (!list) return prev;
      const nextList = list.map((tb) =>
        tb.id === textbookId
          ? {
              ...tb,
              units: tb.units.map((u) =>
                u.unitNumber === unitNumber
                  ? {
                      ...u,
                      status: nextStatus,
                      completedAt:
                        nextStatus === "completed"
                          ? new Date().toISOString()
                          : null,
                    }
                  : u
              ),
            }
          : tb
      );
      return {
        ...prev,
        byStudent: { ...prev.byStudent, [studentId]: nextList },
      };
    });
  }

  if (classes.length === 0) {
    return (
      <div className="rounded-xl border bg-card py-12 text-center">
        <p className="text-sm text-muted-foreground">반이 없습니다.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          반 관리에서 먼저 반을 생성하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 반 selector */}
      <div className="flex flex-wrap items-center gap-2">
        {classes.map((cls) => (
          <button
            key={cls.id}
            type="button"
            onClick={() => handleClassChange(cls.id)}
            disabled={isPending}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              cls.id === selectedClassId
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-white text-slate-700 border-slate-200 hover:border-primary/50 hover:text-primary"
            } disabled:opacity-50`}
          >
            {cls.name}
          </button>
        ))}
      </div>

      <ClassUnitProgressList
        students={data.students}
        byStudent={data.byStudent}
        editable={true}
        onMark={handleMarkUnit}
        loading={isPending}
      />
    </div>
  );
}

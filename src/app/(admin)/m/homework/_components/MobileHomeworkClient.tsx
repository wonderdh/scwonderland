"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  listClassUnitProgressDetailed,
  markUnit,
} from "@/app/(admin)/admin/actions";
import type {
  ClassUnitProgressDetailed,
  HomeworkClassPickerOption,
  UnitStatus,
} from "@/app/(admin)/admin/actions";
import { ClassUnitProgressList } from "@/components/homework/ClassUnitProgressList";

type ClassOption = HomeworkClassPickerOption;

function buildSearchHaystack(c: ClassOption): string {
  const parts = [
    c.name,
    ...c.teacherNames,
    ...c.studentNames.flatMap((s) => [s.ko ?? "", s.en ?? ""]),
  ];
  return parts.join(" ").toLowerCase();
}

type Props = {
  classes: ClassOption[];
  initialClassId: string | null;
  initialData: ClassUnitProgressDetailed;
};

export function MobileHomeworkClient({
  classes,
  initialClassId,
  initialData,
}: Props) {
  const router = useRouter();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(
    initialClassId
  );
  const [data, setData] = useState<ClassUnitProgressDetailed>(initialData);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  const haystacks = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of classes) m.set(c.id, buildSearchHaystack(c));
    return m;
  }, [classes]);

  const filteredClasses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter((c) => {
      if (c.id === selectedClassId) return true; // 선택된 반은 항상 노출 유지
      return (haystacks.get(c.id) ?? "").includes(q);
    });
  }, [classes, search, selectedClassId, haystacks]);

  function handleClassChange(classId: string) {
    setSelectedClassId(classId);
    router.replace(`/m/homework?class=${classId}`, { scroll: false });
    startTransition(async () => {
      const next = await listClassUnitProgressDetailed(classId);
      setData(next);
    });
  }

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
          데스크탑에서 반을 먼저 생성하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 모바일: 검색 + 반 select dropdown */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-slate-600">
          반 선택
        </label>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="반 / 학생 한글·영어 / 선생님 검색"
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-slate-400"
        />
        <select
          value={selectedClassId ?? ""}
          onChange={(e) => handleClassChange(e.target.value)}
          disabled={isPending || filteredClasses.length === 0}
          className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base disabled:opacity-50"
        >
          {filteredClasses.length === 0 ? (
            <option value="">검색 결과 없음</option>
          ) : (
            filteredClasses.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))
          )}
        </select>
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

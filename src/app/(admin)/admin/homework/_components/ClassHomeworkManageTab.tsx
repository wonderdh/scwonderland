"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  startTransition as reactStartTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/overlays/ConfirmDialog";
import {
  listClassUnitProgressDetailed,
  bulkMarkUnits,
  getAbsentStudentIds,
  type ClassUnitProgressDetailed,
  type UnitStatus,
} from "@/app/(admin)/admin/actions/homework-unit-actions";
import {
  listClassTextbooks,
  unassignClassTextbook,
  type ClassTextbookWithDetails,
} from "@/app/(admin)/admin/actions/class-textbook-actions";
import { listAcademyClosedDays } from "@/app/(admin)/admin/actions/closed-days-actions";
import type { HomeworkClassPickerOption } from "@/app/(admin)/admin/actions/class-actions";
import type { TextbookWithSeries } from "@/app/(admin)/admin/actions/textbook-actions";
import type { TeacherOption } from "@/lib/types";
import { ClassUnitProgressList } from "@/components/homework/ClassUnitProgressList";
import { KST_DAY_LABELS, todayDowKst } from "@/lib/utils/date-kst";
import { GROUP_TYPE_TO_LABEL } from "@/lib/constants/class";
import { AssignClassHomeworkModal } from "./AssignClassHomeworkModal";
import { EditClassHomeworkModal } from "./EditClassHomeworkModal";
import { filterChip } from "@/lib/ui/filter-chip";
import { DayChips } from "@/components/badges/DayChips";

const GROUP_FILTERS: { value: string; label: string }[] = [
  { value: "kindergarten", label: GROUP_TYPE_TO_LABEL.kindergarten },
  { value: "afternoon", label: GROUP_TYPE_TO_LABEL.afternoon },
];
type ClassOption = HomeworkClassPickerOption;

function defaultPeriodId(classes: ClassOption[]): string | null {
  for (const c of classes) {
    if (c.groupType !== "afternoon") continue;
    if (!c.periodId || !c.periodLabel || !c.periodStartTime) continue;
    if (c.periodLabel.includes("2:50") || c.periodStartTime.startsWith("14:50")) {
      return c.periodId;
    }
  }
  return null;
}

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
  initialProgress: ClassUnitProgressDetailed;
  initialAssignments: ClassTextbookWithDetails[];
  allTextbooks: TextbookWithSeries[];
  teachers: TeacherOption[];
  initialAbsentStudentIds: string[];
  todayKstProp: string;
};

export function ClassHomeworkManageTab({
  classes,
  initialClassId,
  initialProgress,
  initialAssignments,
  allTextbooks,
  teachers,
  initialAbsentStudentIds,
  todayKstProp,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(initialClassId);
  const [progress, setProgress] = useState<ClassUnitProgressDetailed>(initialProgress);
  const [assignments, setAssignments] = useState<ClassTextbookWithDetails[]>(initialAssignments);
  const [absentStudentIds, setAbsentStudentIds] = useState<ReadonlySet<string>>(
    () => new Set(initialAbsentStudentIds)
  );
  const [closedDates, setClosedDates] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [koreanTeacherId, setKoreanTeacherId] = useState<string | null>(null);
  const [nativeTeacherId, setNativeTeacherId] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<Set<number>>(
    () => new Set([todayDowKst()])
  );
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(
    () => new Set(["afternoon"])
  );
  const [selectedPeriods, setSelectedPeriods] = useState<Set<string>>(
    () => {
      const id = defaultPeriodId(classes);
      return id ? new Set([id]) : new Set();
    }
  );
  const [selectedSeriesIds, setSelectedSeriesIds] = useState<Set<string>>(() => new Set());
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ClassTextbookWithDetails | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ClassTextbookWithDetails | null>(null);

  const koreanTeachers = useMemo(
    () => teachers.filter((t) => t.teacher_type === "korean"),
    [teachers]
  );
  const nativeTeachers = useMemo(
    () => teachers.filter((t) => t.teacher_type === "native"),
    [teachers]
  );
  const availableDays = useMemo(() => {
    const set = new Set<number>();
    for (const c of classes) for (const d of c.daysOfWeek) set.add(d);
    return [...set].sort((a, b) => a - b);
  }, [classes]);

  // 오후반에서 실제 쓰이는 period (id, label, startTime) — 시작시간 ASC.
  const availablePeriods = useMemo(() => {
    const map = new Map<string, { id: string; label: string; startTime: string }>();
    for (const c of classes) {
      if (c.groupType !== "afternoon") continue;
      if (!c.periodId || !c.periodLabel || !c.periodStartTime) continue;
      if (!map.has(c.periodId)) {
        map.set(c.periodId, {
          id: c.periodId,
          label: c.periodLabel,
          startTime: c.periodStartTime,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [classes]);

  const haystacks = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of classes) m.set(c.id, buildSearchHaystack(c));
    return m;
  }, [classes]);

  // 책 필터용 — 부여된 시리즈 / 레벨 목록을 allTextbooks 에서 추출.
  // 어느 반에도 부여 안 된 시리즈/레벨은 의도적으로 노출 (관리자가 "왜 비어있지" 보기 편하게).
  const availableSeries = useMemo(() => {
    const map = new Map<string, string>();
    for (const tb of allTextbooks) {
      if (!tb.series_id) continue;
      if (!map.has(tb.series_id)) {
        map.set(tb.series_id, tb.series_name ?? "");
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [allTextbooks]);

  const availableLevels = useMemo(() => {
    if (selectedSeriesIds.size === 0) return [] as string[];
    const set = new Set<string>();
    for (const tb of allTextbooks) {
      if (!tb.series_id || !selectedSeriesIds.has(tb.series_id)) continue;
      if (tb.level) set.add(tb.level);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));
  }, [allTextbooks, selectedSeriesIds]);

  // 선택된 시리즈/레벨 조합으로 좁혀진 textbook id Set. 둘 다 미선택 시 null
  // (필터 미적용). 선택된 시리즈가 있고 그 시리즈의 레벨 중 일부만 선택했으면
  // 해당 레벨 책만, 레벨 미선택이면 시리즈의 모든 책.
  const matchedTextbookIds = useMemo(() => {
    if (selectedSeriesIds.size === 0) return null;
    const ids = new Set<string>();
    for (const tb of allTextbooks) {
      if (!tb.series_id || !selectedSeriesIds.has(tb.series_id)) continue;
      if (selectedLevel !== null && tb.level !== selectedLevel) continue;
      ids.add(tb.id);
    }
    return ids;
  }, [allTextbooks, selectedSeriesIds, selectedLevel]);

  const filteredClasses = useMemo(() => {
    const q = search.trim().toLowerCase();
    const hasFilter =
      q.length > 0 ||
      koreanTeacherId !== null ||
      nativeTeacherId !== null ||
      selectedDays.size > 0 ||
      selectedGroups.size > 0 ||
      selectedPeriods.size > 0 ||
      matchedTextbookIds !== null;
    if (!hasFilter) return classes;
    return classes.filter((c) => {
      if (c.id === selectedClassId) return true;
      if (q && !(haystacks.get(c.id) ?? "").includes(q)) return false;
      if (koreanTeacherId && !c.teacherIds.includes(koreanTeacherId)) return false;
      if (nativeTeacherId && !c.teacherIds.includes(nativeTeacherId)) return false;
      if (selectedDays.size > 0 && !c.daysOfWeek.some((d) => selectedDays.has(d)))
        return false;
      if (selectedGroups.size > 0 && !(c.groupType && selectedGroups.has(c.groupType)))
        return false;
      if (selectedPeriods.size > 0 && !(c.periodId && selectedPeriods.has(c.periodId)))
        return false;
      if (matchedTextbookIds && !c.assignedTextbookIds.some((id) => matchedTextbookIds.has(id)))
        return false;
      return true;
    });
  }, [
    classes,
    search,
    selectedClassId,
    haystacks,
    koreanTeacherId,
    nativeTeacherId,
    selectedDays,
    selectedGroups,
    selectedPeriods,
    matchedTextbookIds,
  ]);

  function toggleDay(day: number) {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function toggleGroup(group: string) {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  function togglePeriod(periodId: string) {
    setSelectedPeriods((prev) => {
      const next = new Set(prev);
      if (next.has(periodId)) next.delete(periodId);
      else next.add(periodId);
      return next;
    });
  }

  function toggleSeries(seriesId: string) {
    setSelectedSeriesIds((prev) => {
      const next = new Set(prev);
      if (next.has(seriesId)) {
        next.delete(seriesId);
        // 그 시리즈를 풀면 그 시리즈에만 있던 레벨 선택도 정리 (남은 시리즈에 같은 이름 레벨이 있으면 유지)
      } else {
        next.add(seriesId);
      }
      return next;
    });
  }

  function toggleLevel(level: string) {
    setSelectedLevel((prev) => (prev === level ? null : level));
  }

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId) ?? null,
    [classes, selectedClassId]
  );

  async function reloadAll(classId: string) {
    const [nextProgress, nextAssignments, absentResult] = await Promise.all([
      listClassUnitProgressDetailed(classId),
      listClassTextbooks(classId),
      getAbsentStudentIds(todayKstProp),
    ]);
    setProgress(nextProgress);
    setAssignments(nextAssignments);
    setAbsentStudentIds(new Set(absentResult.studentIds));
  }

  function handleClassChange(classId: string) {
    setSelectedClassId(classId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "class");
    params.set("class", classId);
    router.replace(`/admin/homework?${params.toString()}`, { scroll: false });
    startTransition(async () => {
      await reloadAll(classId);
    });
  }

  // 학원 공통 쉬는날 — 미리보기 채점일 계산에서 제외 (한 번만 로드).
  // F8: 에러 처리 + res.error 표면화. 실패 시 preview 가 학원 휴원일을 누락해
  // 서버 결과와 달라질 수 있어 사용자에게 알린다.
  useEffect(() => {
    let alive = true;
    listAcademyClosedDays()
      .then((res) => {
        if (!alive) return;
        if (res.error) {
          toast.error(`학원 휴원일 로드 실패: ${res.error}`);
          return;
        }
        setClosedDates(res.days.map((d) => d.closed_date));
      })
      .catch((e) => {
        if (!alive) return;
        toast.error("학원 휴원일 로드 실패");
        console.error("[ClassHomeworkManageTab listAcademyClosedDays]", e);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (initialClassId === selectedClassId) return;
    reactStartTransition(() => {
      setSelectedClassId(initialClassId);
      setProgress(initialProgress);
      setAssignments(initialAssignments);
    });
  }, [initialClassId, selectedClassId, initialProgress, initialAssignments]);

  function handleSaved() {
    if (!selectedClassId) return;
    startTransition(async () => {
      await reloadAll(selectedClassId);
    });
  }

  function handleRemove() {
    if (!removeTarget || !selectedClassId) return;
    const target = removeTarget;
    startTransition(async () => {
      const result = await unassignClassTextbook(target.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("숙제가 제거됐습니다.");
        await reloadAll(selectedClassId);
      }
      setRemoveTarget(null);
    });
  }

  async function handleSaveUnits(
    allChanges: {
      studentId: string;
      textbookId: string;
      changes: { unitNumber: number; status: UnitStatus }[];
    }[]
  ) {
    const records = allChanges.flatMap(({ studentId, textbookId, changes }) =>
      changes.map(({ unitNumber, status }) => ({ studentId, textbookId, unitNumber, status }))
    );
    const result = await bulkMarkUnits(records, { excludeAbsentOn: todayKstProp });
    if (result.error) {
      toast.error(result.error);
      if (selectedClassId) await reloadAll(selectedClassId);
      throw new Error(result.error);
    }
    const parts = [`저장 ${result.saved}건`];
    if (result.skippedAbsent > 0) parts.push(`결석자 ${result.skippedAbsent}건 제외`);
    toast.success(parts.join(" · "));
    setProgress((prev) => {
      const newByStudent = { ...prev.byStudent };
      for (const { studentId, textbookId, changes } of allChanges) {
        const list = newByStudent[studentId];
        if (!list) continue;
        newByStudent[studentId] = list.map((tb) => {
          if (tb.id !== textbookId) return tb;
          return {
            ...tb,
            units: tb.units.map((u) => {
              const change = changes.find((c) => c.unitNumber === u.unitNumber);
              if (!change) return u;
              return {
                ...u,
                status: change.status,
                completedAt: change.status === "completed" ? new Date().toISOString() : null,
              };
            }),
          };
        });
      }
      return { ...prev, byStudent: newByStudent };
    });
  }

  const assignedTextbookIds = new Set(assignments.map((a) => a.textbook_id));

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
    <div className="space-y-6">
      {/* 반 검색 + selector */}
      <div className="space-y-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="반 이름 / 학생 한글·영어 이름 / 선생님 이름으로 검색"
          className="h-9 w-full max-w-md rounded-md border border-slate-200 bg-white px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {(koreanTeachers.length > 0 ||
          nativeTeachers.length > 0 ||
          availableDays.length > 0 ||
          availablePeriods.length > 0 ||
          availableSeries.length > 0) && (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="shrink-0 text-xs font-semibold text-slate-500 w-16">
                반 구분
              </span>
              {GROUP_FILTERS.map((g) => {
                const active = selectedGroups.has(g.value);
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => toggleGroup(g.value)}
                    className={filterChip(active)}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
            {koreanTeachers.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="shrink-0 text-xs font-semibold text-slate-500 w-16">
                  한국 선생님
                </span>
                {koreanTeachers.map((t) => {
                  const active = koreanTeacherId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setKoreanTeacherId(active ? null : t.id)
                      }
                      className={filterChip(active)}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            )}
            {nativeTeachers.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="shrink-0 text-xs font-semibold text-slate-500 w-16">
                  원어민
                </span>
                {nativeTeachers.map((t) => {
                  const active = nativeTeacherId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setNativeTeacherId(active ? null : t.id)
                      }
                      className={filterChip(active)}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            )}
            {availablePeriods.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="shrink-0 text-xs font-semibold text-slate-500 w-16">
                  시작 시간
                </span>
                {availablePeriods.map((p) => {
                  const active = selectedPeriods.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePeriod(p.id)}
                      className={filterChip(active)}
                    >
                      {p.label}
                    </button>
                  );
                })}
                {selectedPeriods.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedPeriods(new Set())}
                    className="ml-1 text-xs text-slate-400 hover:text-slate-600 underline-offset-2 hover:underline"
                  >
                    초기화
                  </button>
                )}
              </div>
            )}
            {availableDays.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="shrink-0 text-xs font-semibold text-slate-500 w-16">
                  요일
                </span>
                {availableDays.map((d) => {
                  const active = selectedDays.has(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      className={filterChip(active, "min-w-[36px]")}
                    >
                      {KST_DAY_LABELS[d]}
                    </button>
                  );
                })}
                {selectedDays.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedDays(new Set())}
                    className="ml-1 text-xs text-slate-400 hover:text-slate-600 underline-offset-2 hover:underline"
                  >
                    초기화
                  </button>
                )}
              </div>
            )}
            {availableSeries.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="shrink-0 text-xs font-semibold text-slate-500 w-16">
                  시리즈
                </span>
                {availableSeries.map((s) => {
                  const active = selectedSeriesIds.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSeries(s.id)}
                      className={filterChip(active)}
                    >
                      {s.name || "(이름 없음)"}
                    </button>
                  );
                })}
                {selectedSeriesIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSeriesIds(new Set());
                      setSelectedLevel(null);
                    }}
                    className="ml-1 text-xs text-slate-400 hover:text-slate-600 underline-offset-2 hover:underline"
                  >
                    초기화
                  </button>
                )}
              </div>
            )}
            {availableLevels.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="shrink-0 text-xs font-semibold text-slate-500 w-16">
                  레벨
                </span>
                {availableLevels.map((lv) => {
                  const active = selectedLevel === lv;
                  return (
                    <button
                      key={lv}
                      type="button"
                      onClick={() => toggleLevel(lv)}
                      className={filterChip(active)}
                    >
                      {lv}
                    </button>
                  );
                })}
                {selectedLevel !== null && (
                  <button
                    type="button"
                    onClick={() => setSelectedLevel(null)}
                    className="ml-1 text-xs text-slate-400 hover:text-slate-600 underline-offset-2 hover:underline"
                  >
                    초기화
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {filteredClasses.length === 0 ? (
          <p className="text-xs text-slate-500">검색 결과가 없습니다.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {filteredClasses.map((cls) => (
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
        )}
      </div>

      {selectedClass && (
        <>
          {/* 부여 섹션 */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                {selectedClass.name} · 부여된 숙제{" "}
                <span className="text-slate-500 font-normal">
                  ({assignments.length}권)
                </span>
              </h3>
              <Button size="sm" onClick={() => setAssignOpen(true)}>
                + 숙제 부여
              </Button>
            </div>

            {assignments.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-slate-50/50 p-6 text-center text-sm text-slate-400">
                부여된 숙제가 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {assignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      {a.cover_image_url ? (
                        <Image
                          src={a.cover_image_url}
                          alt={a.title}
                          width={48}
                          height={64}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300 text-xs">
                          ?
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {a.series && (
                          <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                            {a.series}
                          </span>
                        )}
                        {a.level && (
                          <span className="inline-block rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                            {a.level}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <DayChips days={(a as ClassTextbookWithDetails & { homework_days?: number[] }).homework_days ?? []} />
                        {a.start_date && (
                          <span className="text-xs text-slate-500">
                            시작 {a.start_date}
                          </span>
                        )}
                        {a.skip_dates && a.skip_dates.length > 0 && (
                          <span className="inline-flex h-5 items-center rounded-full bg-amber-100 px-2 text-[11px] font-medium text-amber-800">
                            예외 {a.skip_dates.length}일
                          </span>
                        )}
                      </div>
                      {a.note && (
                        <p className="text-xs text-slate-400 truncate">
                          {a.note}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => setEditTarget(a)}
                        className="rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemoveTarget(a)}
                        className="rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50 transition-colors"
                      >
                        제거
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 진도 섹션 */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">학생별 진도</h3>
            <ClassUnitProgressList
              students={progress.students}
              byStudent={progress.byStudent}
              editable={true}
              onSave={handleSaveUnits}
              loading={isPending}
              absentStudentIds={absentStudentIds}
            />
          </section>
        </>
      )}

      {assignOpen && selectedClassId && (
        <AssignClassHomeworkModal
          classId={selectedClassId}
          textbooks={allTextbooks}
          assignedTextbookIds={assignedTextbookIds}
          meetDays={progress.meetDays}
          closedDates={closedDates}
          onClose={() => setAssignOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {editTarget && (
        <EditClassHomeworkModal
          assignment={editTarget}
          meetDays={progress.meetDays}
          closedDates={closedDates}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}

      <ConfirmDialog
        open={!!removeTarget}
        title="숙제 제거"
        description={`"${removeTarget?.title}" 을(를) 이 반에서 제거하시겠습니까?`}
        confirmLabel="제거"
        variant="danger"
        onConfirm={handleRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}

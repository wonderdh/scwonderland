"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  LunchDaySchedule,
  LunchClassSchedule,
  LunchStudent,
} from "@/lib/lunch/rotation";
import { formatDateKst } from "@/lib/utils/date-kst";

type ActiveGroup = "age7" | "age6" | "none";

/** 현재 시각(KST) 기준 "지금 이 반"을 판정. 12:20~12:40 → 7세, 12:40~13:00 → 6세. */
function determineActiveGroup(now: Date): ActiveGroup {
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins >= 12 * 60 + 20 && mins < 12 * 60 + 40) return "age7";
  if (mins >= 12 * 60 + 40 && mins < 13 * 60) return "age6";
  return "none";
}

function formatClock(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function LunchMonitorClient({ schedule }: { schedule: LunchDaySchedule }) {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // 클라이언트 mount 후 시계 표시 — hydration 미스매치 방지 + 1초마다 갱신
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const tick = setInterval(() => setNow(new Date()), 1000);
    // 5분마다 서버 데이터 리프레시
    const refresh = setInterval(() => {
      router.refresh();
    }, 5 * 60 * 1000);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [router]);

  const activeGroup = now ? determineActiveGroup(now) : "none";

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="flex items-center justify-between px-8 py-4 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-bold">점심지도</h1>
          <p className="text-xl text-slate-400">
            {formatDateKst(schedule.date)} ({schedule.weekdayLabel}요일)
          </p>
        </div>
        {now && (
          <div className="text-5xl font-mono font-bold tabular-nums">
            {formatClock(now)}
          </div>
        )}
      </header>

      <main className="px-8 py-6 space-y-6">
        <TimeBlock
          timeLabel="12:20"
          title="7세반"
          groups={schedule.age7Groups}
          active={activeGroup === "age7"}
        />
        <TimeBlock
          timeLabel="12:40"
          title="6세반"
          groups={schedule.age6Groups}
          active={activeGroup === "age6"}
        />
      </main>
    </div>
  );
}

function TimeBlock({
  timeLabel,
  title,
  groups,
  active,
}: {
  timeLabel: string;
  title: string;
  groups: LunchClassSchedule[];
  active: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border-2 p-6 transition-colors ${
        active
          ? "border-orange-400 bg-orange-950/30 shadow-[0_0_40px_rgba(251,146,60,0.3)]"
          : "border-slate-800 bg-slate-950/50"
      }`}
    >
      <div className="flex items-center gap-4 mb-5">
        <span
          className={`rounded-full px-5 py-2 text-3xl font-bold ${
            active ? "bg-orange-500 text-white" : "bg-slate-800 text-slate-300"
          }`}
        >
          {timeLabel}
        </span>
        <h2 className="text-2xl font-bold text-slate-200">{title}</h2>
        {active && (
          <span className="ml-auto animate-pulse rounded-full bg-orange-500 px-4 py-1 text-lg font-bold">
            지금 이 시간
          </span>
        )}
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {groups.map((group, idx) => (
          <ClassCard key={group.class_id} order={idx + 1} group={group} />
        ))}
      </div>
    </section>
  );
}

function ClassCard({
  order,
  group,
}: {
  order: number;
  group: LunchClassSchedule;
}) {
  const isFirst = order === 1;
  return (
    <div
      className={`rounded-xl p-5 ${
        isFirst
          ? "bg-gradient-to-br from-blue-600 to-blue-800 text-white"
          : "bg-slate-800 text-slate-100"
      }`}
    >
      <div className="flex items-center gap-3 mb-4">
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl font-bold ${
            isFirst ? "bg-white text-blue-700" : "bg-slate-700 text-slate-200"
          }`}
        >
          {order}
        </span>
        <div>
          <p
            className={`text-xs uppercase tracking-wider ${
              isFirst ? "text-blue-200" : "text-slate-400"
            }`}
          >
            {isFirst ? "먼저 출발" : "다음 출발"}
          </p>
          <h3 className="text-3xl font-bold">{group.class_name}</h3>
        </div>
      </div>

      <ol className="space-y-2">
        {group.students.map((s, i) => (
          <StudentRow
            key={s.profile_id}
            index={i + 1}
            student={s}
            isFirst={isFirst}
          />
        ))}
      </ol>
    </div>
  );
}

function StudentRow({
  index,
  student,
  isFirst,
}: {
  index: number;
  student: LunchStudent;
  isFirst: boolean;
}) {
  const baseText = isFirst ? "text-white" : "text-slate-100";
  return (
    <li
      className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
        student.isLeader
          ? isFirst
            ? "bg-white/20 ring-2 ring-white"
            : "bg-amber-500/20 ring-2 ring-amber-400"
          : ""
      } ${student.isAbsent ? "opacity-40" : ""}`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold ${
          student.isLeader
            ? isFirst
              ? "bg-white text-blue-700"
              : "bg-amber-400 text-slate-900"
            : isFirst
              ? "bg-blue-900 text-blue-200"
              : "bg-slate-700 text-slate-300"
        }`}
      >
        {index}
      </span>
      <div
        className={`flex-1 min-w-0 text-2xl font-bold ${baseText} ${
          student.isAbsent ? "line-through" : ""
        }`}
      >
        {student.english_name ?? "?"}
        {student.korean_name && (
          <span
            className={`ml-3 text-lg font-normal ${
              isFirst ? "text-blue-100" : "text-slate-400"
            }`}
          >
            {student.korean_name}
          </span>
        )}
      </div>
      {student.isLeader && !student.isAbsent && (
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${
            isFirst ? "bg-white text-blue-700" : "bg-amber-400 text-slate-900"
          }`}
        >
          LEADER
        </span>
      )}
      {student.isAbsent && (
        <span className="shrink-0 rounded-full bg-red-500 px-3 py-1 text-sm font-bold text-white">
          결석
        </span>
      )}
    </li>
  );
}

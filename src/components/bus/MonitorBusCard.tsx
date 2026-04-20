import type { BusManifestGroup, BusManifestEntry, BusManifestExtraStop } from "@/lib/types";
import { getAgeColor } from "@/lib/ui/student-age-colors";
import { groupStudentsByStop, formatTime, formatCheckedTime, type StopGroup } from "@/lib/bus/utils";
import { formatStudentName } from "@/lib/utils/student-name";

// 학생 있는 정류장 + 학생 없는 정류장(show_empty_stops) 을 한 리스트로 병합.
// sort_order → estimated_time → stopName 순으로 정렬.
function mergeStopGroups(
  students: BusManifestEntry[],
  extras: BusManifestExtraStop[] | undefined
): StopGroup[] {
  const fromStudents = groupStudentsByStop(students);
  if (!extras?.length) return fromStudents;

  type Enriched = StopGroup & { sortOrder: number };
  const enriched: Enriched[] = fromStudents.map((g) => ({
    ...g,
    sortOrder: g.students[0]?.bus_stop_sort_order ?? 9999,
  }));

  const existingNames = new Set(enriched.map((g) => g.stopName));
  for (const extra of extras) {
    if (existingNames.has(extra.bus_stop_name)) continue;
    enriched.push({
      stopName: extra.bus_stop_name,
      estimatedTime: extra.estimated_time,
      students: [],
      sortOrder: extra.bus_stop_sort_order ?? 9999,
    });
  }

  enriched.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const ta = a.estimatedTime ?? "99:99";
    const tb = b.estimatedTime ?? "99:99";
    if (ta !== tb) return ta.localeCompare(tb);
    return a.stopName.localeCompare(b.stopName);
  });

  return enriched.map(({ sortOrder: _unused, ...rest }) => rest);
}

// 호차별 색상 팔레트 (Tailwind purge-safe 리터럴)
export const BUS_CARD_COLORS = [
  { bg: "bg-blue-50", border: "border-l-blue-500", text: "text-blue-700" },
  { bg: "bg-emerald-50", border: "border-l-emerald-500", text: "text-emerald-700" },
  { bg: "bg-amber-50", border: "border-l-amber-500", text: "text-amber-700" },
  { bg: "bg-purple-50", border: "border-l-purple-500", text: "text-purple-700" },
  { bg: "bg-rose-50", border: "border-l-rose-500", text: "text-rose-700" },
  { bg: "bg-cyan-50", border: "border-l-cyan-500", text: "text-cyan-700" },
  { bg: "bg-indigo-50", border: "border-l-indigo-500", text: "text-indigo-700" },
  { bg: "bg-orange-50", border: "border-l-orange-500", text: "text-orange-700" },
] as const;

export type BusCardColor = (typeof BUS_CARD_COLORS)[number];

// --- ProgressBar ---

type AdminProgressBarProps = {
  variant: "admin";
  boarded: number;
  checked: number;
  total: number;
};

type MonitorProgressBarProps = {
  variant: "monitor";
  boarded: number;
  total: number;
};

type ProgressBarProps = AdminProgressBarProps | MonitorProgressBarProps;

const PROGRESS_COLORS = {
  high: "bg-blue-500",
  mid: "bg-amber-500",
  low: "bg-red-500",
} as const;

export function ProgressBar(props: ProgressBarProps) {
  if (props.variant === "admin") {
    const { boarded, checked, total } = props;
    const boardedPct = total > 0 ? Math.round((boarded / total) * 100) : 0;
    const checkedPct = total > 0 ? Math.round((checked / total) * 100) : 0;

    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden relative">
          {/* 탑승 바 (파란색, 전체 너비) */}
          <div
            className="absolute inset-y-0 left-0 bg-blue-400 rounded-full transition-all duration-300"
            style={{ width: `${boardedPct}%` }}
          />
          {/* 하차 바 (초록색, 겹침) */}
          <div
            className="absolute inset-y-0 left-0 bg-green-500 rounded-full transition-all duration-300"
            style={{ width: `${checkedPct}%` }}
          />
        </div>
        <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
          {boarded}/{total}명
        </span>
      </div>
    );
  }

  // variant === "monitor"
  const { boarded, total } = props;
  const pct = total > 0 ? Math.round((boarded / total) * 100) : 0;
  const colorKey = pct >= 90 ? "high" : pct >= 50 ? "mid" : "low";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${PROGRESS_COLORS[colorKey]} rounded-full transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// --- MonitorBusCard ---

type AdminMonitorBusCardProps = {
  variant: "admin";
  card: BusManifestGroup;
};

type MonitorMonitorBusCardProps = {
  variant: "monitor";
  card: BusManifestGroup;
  color: BusCardColor;
};

type MonitorBusCardProps = AdminMonitorBusCardProps | MonitorMonitorBusCardProps;

export function MonitorBusCard(props: MonitorBusCardProps) {
  const { card } = props;
  const activeStudents = card.students.filter((s) => !s.is_absent);
  const boardedCount = activeStudents.filter(
    (s) => s.boarded_at || s.checked_at
  ).length;
  const checkedCount = activeStudents.filter((s) => s.checked_at).length;
  const totalCount = activeStudents.length;
  const allDone = checkedCount === totalCount && totalCount > 0;
  const stopGroups = mergeStopGroups(card.students, card.extra_stops);

  if (props.variant === "admin") {
    return <AdminBusCard card={card} boardedCount={boardedCount} checkedCount={checkedCount} totalCount={totalCount} allDone={allDone} stopGroups={stopGroups} />;
  }

  return <MonitorCard card={card} color={props.color} boardedCount={boardedCount} checkedCount={checkedCount} totalCount={totalCount} allDone={allDone} stopGroups={stopGroups} />;
}

// --- Admin variant internals ---

type CardInternals = {
  card: BusManifestGroup;
  boardedCount: number;
  checkedCount: number;
  totalCount: number;
  allDone: boolean;
  stopGroups: StopGroup[];
};

function AdminBusCard({ card, boardedCount, checkedCount, totalCount, allDone, stopGroups }: CardInternals) {
  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* 카드 헤더 */}
      <div className={`px-4 py-3 ${allDone ? "bg-green-50" : "bg-slate-50"}`}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-semibold text-slate-700">
            {card.bus_label}
          </span>
          <span className="text-xs font-medium text-slate-500">
            {allDone
              ? "완료"
              : `탑승 ${boardedCount}/${totalCount} · 하차 ${checkedCount}/${totalCount}`}
          </span>
        </div>
        <ProgressBar
          variant="admin"
          boarded={boardedCount}
          checked={checkedCount}
          total={totalCount}
        />
      </div>

      {/* 정류장별 학생 타임라인 */}
      <div className="divide-y divide-slate-100">
        {stopGroups.map((group, gi) => (
          <div key={gi}>
            {/* 정류장 헤더 */}
            {(group.stopName || group.estimatedTime) && (
              <div className="px-4 py-1.5 bg-slate-50/60 flex items-center gap-2">
                <span className="text-xs text-slate-500">▸</span>
                {group.estimatedTime && (
                  <span className="text-xs font-medium text-slate-600">
                    {formatTime(group.estimatedTime)}
                  </span>
                )}
                {group.stopName && (
                  <span className="text-xs text-slate-500 truncate">
                    📍 {group.stopName}
                  </span>
                )}
              </div>
            )}

            {group.students.length === 0 && (
              <div className="px-4 py-1.5 pl-8 text-xs italic text-slate-400">
                배정 학생 없음
              </div>
            )}

            {/* 학생 목록 */}
            {group.students.map((student) => {
              const isBoarded = !!student.boarded_at;
              const isChecked = !!student.checked_at;

              const rowBg = isChecked
                ? "bg-green-50/40"
                : student.is_changed
                  ? "bg-amber-50"
                  : isBoarded
                    ? "bg-blue-50/30"
                    : "";

              return (
                <div
                  key={student.student_profile_id}
                  className={`px-4 py-1.5 pl-8 flex items-center gap-2 text-sm ${rowBg}`}
                >
                  <span className="text-xs shrink-0">
                    {isChecked ? "✅" : isBoarded ? "🚌" : "⬜"}
                  </span>
                  <div className="flex-1 min-w-0">
                    {isChecked ? (
                      <span className="block truncate text-slate-400 line-through">
                        {formatStudentName(student, { fallback: "" })}
                      </span>
                    ) : (
                      <span className={`inline-block truncate px-1.5 py-0.5 rounded text-xs font-medium ${getAgeColor(student.age).bg} ${getAgeColor(student.age).text}`}>
                        {formatStudentName(student, { fallback: "" })}
                      </span>
                    )}
                    {student.is_changed && student.original_bus_label && (
                      <span className="block text-[10px] text-amber-500">
                        {student.original_bus_label} → {card.bus_label}
                      </span>
                    )}
                    {student.note && (
                      <span className="block text-[10px] text-slate-400">
                        {student.note}
                      </span>
                    )}
                  </div>
                  {isBoarded && student.boarded_at && !isChecked && (
                    <span className="text-xs text-blue-600 shrink-0">
                      탑승 {formatCheckedTime(student.boarded_at)}
                    </span>
                  )}
                  {isChecked && student.checked_at && (
                    <span className="text-xs text-green-600 shrink-0">
                      하차 {formatCheckedTime(student.checked_at)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Monitor variant internals ---

type MonitorCardProps = CardInternals & { color: BusCardColor };

function renderMonitorStudent(student: BusManifestEntry, card: BusManifestGroup) {
  const isBoarded = !!student.boarded_at;
  const isChecked = !!student.checked_at;

  const rowBg = isChecked
    ? "bg-green-50/50"
    : student.is_changed
      ? "bg-amber-50"
      : isBoarded
        ? "bg-blue-50/40"
        : "";

  return (
    <div
      key={student.student_profile_id}
      className={`px-3 py-1 flex items-center gap-2 ${rowBg}`}
      style={student.is_absent ? { backgroundColor: "#fff7ed", borderLeft: "4px solid #f97316" } : undefined}
    >
      <span className="text-xl shrink-0">
        {isChecked ? "✅" : isBoarded ? "🚌" : student.is_absent ? "🔴" : "⬜"}
      </span>
      <div className="flex-1 min-w-0">
        <span
          className={`block truncate text-2xl ${
            isChecked
              ? "text-slate-400 line-through"
              : student.is_absent
                ? "font-bold text-orange-600"
                : `font-bold ${getAgeColor(student.age).text}`
          }`}
        >
          {formatStudentName(student, { fallback: "" })}
        </span>
        {student.is_absent && (
          <span className="block truncate text-xs text-orange-500 font-medium -mt-0.5">
            결석
          </span>
        )}
        {!student.is_absent && student.is_changed && student.original_bus_label && (
          <span className="block truncate text-xs text-amber-500 -mt-0.5">
            {student.original_bus_label} → {card.bus_label}
          </span>
        )}
        {!student.is_absent && student.note && (
          <span className="block truncate text-xs text-slate-400 -mt-0.5">
            {student.note}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {isBoarded && student.boarded_at && !isChecked && (
          <span className="text-base text-blue-600 font-medium">
            {formatCheckedTime(student.boarded_at)}
          </span>
        )}
        {isChecked && student.checked_at && (
          <span className="text-base text-green-600 font-medium">
            {formatCheckedTime(student.checked_at)}
          </span>
        )}
      </div>
    </div>
  );
}

function renderMonitorStopGroup(group: StopGroup, gi: number, card: BusManifestGroup) {
  const isEmpty = group.students.length === 0;
  return (
    <div key={gi}>
      {(group.stopName || group.estimatedTime) && (
        <div className="px-4 py-1 bg-slate-50/60 flex items-center gap-2">
          <span className="text-sm text-slate-500">▸</span>
          {group.estimatedTime && (
            <span className="text-sm font-semibold text-slate-600">
              {formatTime(group.estimatedTime)}
            </span>
          )}
          {group.stopName && (
            <span className="text-sm text-slate-500 truncate">
              📍 {group.stopName}
            </span>
          )}
        </div>
      )}
      {isEmpty ? (
        <div className="px-4 py-1.5 text-sm text-slate-400 italic">
          배정 학생 없음
        </div>
      ) : (
        <div className="grid grid-cols-2">
          {group.students.map((s) => renderMonitorStudent(s, card))}
        </div>
      )}
    </div>
  );
}

function MonitorCard({ card, color, boardedCount, checkedCount, totalCount, allDone, stopGroups }: MonitorCardProps) {
  return (
    <div className={`rounded-xl border border-l-4 ${color.border} bg-white shadow-sm overflow-hidden`}>
      <div className={`px-4 py-2.5 ${allDone ? "bg-green-50" : color.bg}`}>
        <div className="flex items-center justify-between mb-1">
          <span className={`text-2xl font-extrabold ${color.text}`}>
            {card.bus_label}
          </span>
          <span className="text-base font-medium text-slate-500">
            탑승 {boardedCount}/{totalCount} · 하차 {checkedCount}/{totalCount}
          </span>
        </div>
        <ProgressBar variant="monitor" boarded={boardedCount} total={totalCount} />
      </div>

      <div className="divide-y divide-slate-100">
        {stopGroups.map((g, i) => renderMonitorStopGroup(g, i, card))}
      </div>
    </div>
  );
}

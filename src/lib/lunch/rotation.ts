/**
 * 점심지도 로테이션 — Anchor 방식.
 *
 * 핵심 규칙:
 * - 기본 EPOCH(2026-04-20 월) 기준 "경과 영업일수(월~금)"로 반 순서·리더 자동 회전.
 * - 리더 anchor 또는 반 순서 anchor 가 등록되면 그 날짜부터 영구 적용:
 *   - 리더 anchor: anchor 날 지정 학생이 리더, 이후는 anchor 날로부터 경과 영업일만큼 알파벳 순 circular rotation.
 *   - 반 순서 anchor: anchor 날 지정 반이 먼저, 이후는 영업일 홀짝으로 교대.
 * - 조회 날짜 이전의 가장 최근 anchor 가 적용. anchor 없으면 EPOCH 기준 계산.
 * - 결석/조퇴 학생은 명단에 유지 (isAbsent 플래그만 true). 순번은 안 빠짐.
 */

export const LUNCH_ROTATION_EPOCH = "2026-04-20"; // 월요일

export type LunchGroup = "7세" | "6세";

export type LunchStudent = {
  profile_id: string;
  korean_name: string | null;
  english_name: string | null;
  age: number | null;
  isAbsent: boolean;
  isLeader: boolean;
};

export type LunchClassSchedule = {
  class_id: string;
  class_name: string;
  lunch_group: LunchGroup;
  students: LunchStudent[]; // 줄 순서. 첫 번째가 리더.
  leader_anchor_id: string | null; // 활성 리더 anchor row id
  leader_anchor_date: string | null;
};

export type LunchDaySchedule = {
  date: string;
  isoDayOfWeek: number; // 1=월 ... 7=일
  weekdayLabel: string;
  age7Groups: LunchClassSchedule[];
  age6Groups: LunchClassSchedule[];
  class_order_anchors: {
    age7: { id: string; effective_from: string; first_class_id: string } | null;
    age6: { id: string; effective_from: string; first_class_id: string } | null;
  };
};

/** YYYY-MM-DD 문자열을 UTC 자정 Date로 파싱 — 서버 타임존 무관. */
function parseYmdUtc(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** 영업일수(월~금) 카운트. epoch → target 방향이면 양수. */
export function businessDaysBetween(epoch: string, target: string): number {
  const e = parseYmdUtc(epoch);
  const t = parseYmdUtc(target);
  const direction = e <= t ? 1 : -1;
  const [a, b] = direction === 1 ? [e, t] : [t, e];
  let count = 0;
  const cursor = new Date(a);
  while (cursor < b) {
    const dow = cursor.getUTCDay();
    if (dow >= 1 && dow <= 5) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count * direction;
}

/** 2반을 offset 홀짝으로 교대. */
export function rotateClassPair<T>(pair: [T, T], offset: number): [T, T] {
  return offset % 2 === 0 ? pair : [pair[1], pair[0]];
}

/** 배열을 offset만큼 circular rotation (앞에서부터 offset번째가 맨 앞으로). */
export function rotateLeader<T>(students: T[], offset: number): T[] {
  if (students.length === 0) return [];
  const start = ((offset % students.length) + students.length) % students.length;
  return [...students.slice(start), ...students.slice(0, start)];
}

/** 영어 이름 알파벳 순 (null은 뒤). */
export function sortByEnglishName<T extends { english_name: string | null }>(students: T[]): T[] {
  return [...students].sort((a, b) => {
    const aN = a.english_name ?? "";
    const bN = b.english_name ?? "";
    if (!aN && !bN) return 0;
    if (!aN) return 1;
    if (!bN) return -1;
    return aN.localeCompare(bN, "en", { sensitivity: "base" });
  });
}

// ── Anchor 타입 ───────────────────────────────────────────────────────────

export type LeaderAnchor = {
  id: string;
  effective_from: string;
  class_id: string;
  leader_student_id: string;
};

export type ClassOrderAnchor = {
  id: string;
  effective_from: string;
  lunch_group: LunchGroup;
  first_class_id: string;
};

/** targetDate 에서 가장 최근 유효한 anchor (effective_from <= targetDate). */
function findActiveAnchor<T extends { effective_from: string }>(
  anchors: T[],
  targetDate: string,
): T | null {
  let best: T | null = null;
  for (const a of anchors) {
    if (a.effective_from > targetDate) continue;
    if (!best || a.effective_from > best.effective_from) best = a;
  }
  return best;
}

// ── Resolve 로직 ──────────────────────────────────────────────────────────

type BuildInput = {
  class_id: string;
  class_name: string;
  lunch_group: LunchGroup;
  students: Array<{
    profile_id: string;
    korean_name: string | null;
    english_name: string | null;
    age: number | null;
  }>;
  absentIds: Set<string>;
};

/** 리더 anchor 적용 — anchor 있으면 anchor 기준 회전, 없으면 EPOCH 기준. */
function resolveLeaderOrder(
  targetDate: string,
  sorted: BuildInput["students"],
  classAnchors: LeaderAnchor[],
): { ordered: BuildInput["students"]; anchor: LeaderAnchor | null } {
  const anchor = findActiveAnchor(classAnchors, targetDate);

  if (anchor) {
    const anchorIdx = sorted.findIndex((s) => s.profile_id === anchor.leader_student_id);
    if (anchorIdx >= 0) {
      const days = businessDaysBetween(anchor.effective_from, targetDate);
      const currentIdx =
        ((anchorIdx + days) % sorted.length + sorted.length) % sorted.length;
      return {
        ordered: [...sorted.slice(currentIdx), ...sorted.slice(0, currentIdx)],
        anchor,
      };
    }
  }

  // anchor 없거나 학생이 삭제됨 → EPOCH 기준
  const offset = businessDaysBetween(LUNCH_ROTATION_EPOCH, targetDate);
  return { ordered: rotateLeader(sorted, offset), anchor: null };
}

/** 반 순서 anchor 적용 — anchor 있으면 anchor 기준 교대, 없으면 EPOCH 기준. */
function resolveClassOrder(
  targetDate: string,
  pair: [BuildInput, BuildInput],
  anchors: ClassOrderAnchor[],
): { ordered: [BuildInput, BuildInput]; anchor: ClassOrderAnchor | null } {
  const anchor = findActiveAnchor(anchors, targetDate);

  if (anchor) {
    const firstIdx = pair.findIndex((c) => c.class_id === anchor.first_class_id);
    if (firstIdx >= 0) {
      const anchorOrder: [BuildInput, BuildInput] =
        firstIdx === 0 ? pair : [pair[1], pair[0]];
      const days = businessDaysBetween(anchor.effective_from, targetDate);
      return {
        ordered: days % 2 === 0 ? anchorOrder : [anchorOrder[1], anchorOrder[0]],
        anchor,
      };
    }
  }

  const offset = businessDaysBetween(LUNCH_ROTATION_EPOCH, targetDate);
  return { ordered: rotateClassPair(pair, offset), anchor: null };
}

function buildClassSchedule(
  input: BuildInput,
  ordered: BuildInput["students"],
  leaderAnchor: LeaderAnchor | null,
): LunchClassSchedule {
  const students: LunchStudent[] = ordered.map((s, idx) => ({
    profile_id: s.profile_id,
    korean_name: s.korean_name,
    english_name: s.english_name,
    age: s.age,
    isAbsent: input.absentIds.has(s.profile_id),
    isLeader: idx === 0,
  }));

  return {
    class_id: input.class_id,
    class_name: input.class_name,
    lunch_group: input.lunch_group,
    students,
    leader_anchor_id: leaderAnchor?.id ?? null,
    leader_anchor_date: leaderAnchor?.effective_from ?? null,
  };
}

const WEEKDAY_LABELS_KO = ["일", "월", "화", "수", "목", "금", "토"];

export function computeLunchDaySchedule(args: {
  date: string;
  age7Classes: [BuildInput, BuildInput];
  age6Classes: [BuildInput, BuildInput];
  leaderAnchors: LeaderAnchor[];
  classOrderAnchors: ClassOrderAnchor[];
}): LunchDaySchedule {
  const buildGroup = (input: BuildInput): LunchClassSchedule => {
    const sorted = sortByEnglishName(input.students);
    const classAnchors = args.leaderAnchors.filter((a) => a.class_id === input.class_id);
    const { ordered, anchor } = resolveLeaderOrder(args.date, sorted, classAnchors);
    return buildClassSchedule(input, ordered, anchor);
  };

  const age7Order = resolveClassOrder(
    args.date,
    args.age7Classes,
    args.classOrderAnchors.filter((a) => a.lunch_group === "7세"),
  );
  const age6Order = resolveClassOrder(
    args.date,
    args.age6Classes,
    args.classOrderAnchors.filter((a) => a.lunch_group === "6세"),
  );

  const age7Groups = age7Order.ordered.map(buildGroup);
  const age6Groups = age6Order.ordered.map(buildGroup);

  const d = parseYmdUtc(args.date);
  const dow = d.getUTCDay();
  const isoDayOfWeek = dow === 0 ? 7 : dow;

  return {
    date: args.date,
    isoDayOfWeek,
    weekdayLabel: WEEKDAY_LABELS_KO[dow] ?? "",
    age7Groups,
    age6Groups,
    class_order_anchors: {
      age7: age7Order.anchor
        ? {
            id: age7Order.anchor.id,
            effective_from: age7Order.anchor.effective_from,
            first_class_id: age7Order.anchor.first_class_id,
          }
        : null,
      age6: age6Order.anchor
        ? {
            id: age6Order.anchor.id,
            effective_from: age6Order.anchor.effective_from,
            first_class_id: age6Order.anchor.first_class_id,
          }
        : null,
    },
  };
}

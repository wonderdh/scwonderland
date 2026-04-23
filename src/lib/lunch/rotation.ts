/**
 * 점심지도 로테이션 결정론 계산.
 *
 * 규칙:
 * - 반 순서: 경과 영업일수(월~금) % 2 로 2반 교대
 * - 리더: 경과 영업일수 % 학생수 로 알파벳 순서 시작점 회전
 * - Override 있으면 override 지정 학생을 리더로 + 뒤는 circular rotation
 * - 결석/조퇴 학생은 명단에 유지 (isAbsent 플래그만 true)
 *
 * 설계: /office-hours 2026-04-23 세션 결과물
 * 로테이션 기준일(EPOCH)은 월요일. 변경 시 전체 회전 오프셋이 바뀜.
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
  students: LunchStudent[]; // 줄 순서대로 정렬됨. 첫 번째가 리더.
  leader_override_id: string | null; // override row id — 있으면 "override 적용 중" 표시
};

export type LunchDaySchedule = {
  date: string; // YYYY-MM-DD
  isoDayOfWeek: number; // 1=월 ... 7=일
  weekdayLabel: string;
  age7Groups: LunchClassSchedule[]; // 2개. 인덱스 0이 먼저 올라가는 반.
  age6Groups: LunchClassSchedule[];
};

/**
 * 2개 날짜 사이의 영업일수(월~금)만 카운트.
 * epoch가 target보다 뒤면 음수.
 */
export function businessDaysBetween(epoch: string, target: string): number {
  const e = new Date(`${epoch}T00:00:00+09:00`);
  const t = new Date(`${target}T00:00:00+09:00`);
  const direction = e <= t ? 1 : -1;
  const [a, b] = direction === 1 ? [e, t] : [t, e];
  let count = 0;
  const cursor = new Date(a);
  while (cursor < b) {
    const dow = cursor.getDay(); // 0=일 ... 6=토
    if (dow >= 1 && dow <= 5) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count * direction;
}

/** 2반을 영업일수에 맞게 교대. offset이 짝수면 원본, 홀수면 뒤집음. */
export function rotateClassPair<T>(pair: [T, T], offset: number): [T, T] {
  return offset % 2 === 0 ? pair : [pair[1], pair[0]];
}

/**
 * 학생 배열을 영업일수 기반으로 circular rotation.
 * offset 번째 학생부터 시작해서 배열 끝까지 + 처음부터 offset-1까지.
 */
export function rotateLeader<T>(students: T[], offset: number): T[] {
  if (students.length === 0) return [];
  const start = ((offset % students.length) + students.length) % students.length;
  return [...students.slice(start), ...students.slice(0, start)];
}

/** 영어 이름 알파벳 순 (null은 뒤로). 대소문자 무시. */
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
  overrideLeaderId: string | null;
  overrideId: string | null;
  absentIds: Set<string>;
};

function buildClassSchedule(input: BuildInput, offset: number): LunchClassSchedule {
  const sorted = sortByEnglishName(input.students);
  let ordered: typeof sorted;

  if (input.overrideLeaderId) {
    const leaderIdx = sorted.findIndex((s) => s.profile_id === input.overrideLeaderId);
    if (leaderIdx >= 0) {
      ordered = [...sorted.slice(leaderIdx), ...sorted.slice(0, leaderIdx)];
    } else {
      ordered = rotateLeader(sorted, offset);
    }
  } else {
    ordered = rotateLeader(sorted, offset);
  }

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
    leader_override_id: input.overrideId,
  };
}

const WEEKDAY_LABELS_KO = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 하루치 점심지도 일정 계산.
 * classesByGroup은 각 group별 2반(class_id ASC 등 안정 정렬)으로 정렬돼 있다고 가정.
 */
export function computeLunchDaySchedule(args: {
  date: string;
  epoch?: string;
  age7Classes: [BuildInput, BuildInput];
  age6Classes: [BuildInput, BuildInput];
}): LunchDaySchedule {
  const epoch = args.epoch ?? LUNCH_ROTATION_EPOCH;
  const offset = businessDaysBetween(epoch, args.date);

  const age7Pair = rotateClassPair(args.age7Classes, offset);
  const age6Pair = rotateClassPair(args.age6Classes, offset);

  const age7Groups = age7Pair.map((cls) => buildClassSchedule(cls, offset));
  const age6Groups = age6Pair.map((cls) => buildClassSchedule(cls, offset));

  const d = new Date(`${args.date}T00:00:00+09:00`);
  const dow = d.getDay();
  const isoDayOfWeek = dow === 0 ? 7 : dow;

  return {
    date: args.date,
    isoDayOfWeek,
    weekdayLabel: WEEKDAY_LABELS_KO[dow] ?? "",
    age7Groups,
    age6Groups,
  };
}

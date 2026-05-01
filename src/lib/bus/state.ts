/**
 * Bus 도메인 상태 머신 단일 소스.
 *
 * 2026-04-22 리뷰의 churn hotspot 분석에서 `"change"|"no_ride"|"absent"` 리터럴이
 * 10+ 파일에 인라인 중복됨이 드러남. 여기서 `as const`로 고정하고 파생 타입을
 * re-export해서 단일 소스화 (M-09 Phase 1-A).
 *
 * UI config(label·icon·badgeClass)는 `src/lib/constants/bus.ts`에 그대로 유지.
 */

/** 변경 유형 전체. admin·학생·결석 연동 포함. */
export const BUS_CHANGE_TYPES = ["change", "no_ride", "absent", "temporary_change"] as const;
export type BusChangeType = (typeof BUS_CHANGE_TYPES)[number];

/**
 * 학생이 직접 제출 가능한 변경 유형. `absent`는 출결(결석) 연동으로만 DB에
 * 생성되므로 학생 제출 폼에서는 제외. `submitBusChangeRequest` 시그니처에서
 * 타입으로 강제.
 */
export const STUDENT_SUBMITTABLE_CHANGE_TYPES = ["change", "no_ride"] as const;
export type StudentSubmittableChangeType =
  (typeof STUDENT_SUBMITTABLE_CHANGE_TYPES)[number];

/** 매니페스트의 noRides 엔트리 서브셋 (change 제외). */
export type NoRideChangeType = Exclude<BusChangeType, "change">;

/** 변경요청 상태. */
export const BUS_REQUEST_STATUSES = ["pending", "approved", "rejected"] as const;
export type BusRequestStatus = (typeof BUS_REQUEST_STATUSES)[number];

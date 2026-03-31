// 반 그룹 순서 (전체 앱에서 공유)
export const GROUP_ORDER = ["유치부", "오후반", ""] as const;
export type GroupKey = (typeof GROUP_ORDER)[number];

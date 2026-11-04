// 반 그룹 순서 (전체 앱에서 공유)
export const GROUP_ORDER = ["유치부", "오후반", ""] as const;
export type GroupKey = (typeof GROUP_ORDER)[number];

// group_type ↔ 한글 라벨 — single source of truth: src/lib/server/domain-helpers.ts
// Re-exported as Record<string, string> for client components that index with arbitrary strings.
import {
  GROUP_TYPE_TO_LABEL as _GROUP_TYPE_TO_LABEL,
  GROUP_LABEL_TO_TYPE as _GROUP_LABEL_TO_TYPE,
} from "@/lib/server/domain-helpers";

export const GROUP_TYPE_TO_LABEL: Record<string, string> = _GROUP_TYPE_TO_LABEL;
export const GROUP_LABEL_TO_TYPE: Record<string, string> = _GROUP_LABEL_TO_TYPE;

// IMPORTANT: All strings must be complete Tailwind class names (no dynamic concat) for purging to work.
export const CLASS_COLOR_PALETTE: { bg: string; text: string; border: string }[] = [
  { bg: "bg-blue-100",    text: "text-blue-800",    border: "border-blue-300"    },
  { bg: "bg-emerald-100", text: "text-emerald-800",  border: "border-emerald-300" },
  { bg: "bg-violet-100",  text: "text-violet-800",   border: "border-violet-300"  },
  { bg: "bg-amber-100",   text: "text-amber-800",    border: "border-amber-300"   },
  { bg: "bg-rose-100",    text: "text-rose-800",     border: "border-rose-300"    },
  { bg: "bg-cyan-100",    text: "text-cyan-800",     border: "border-cyan-300"    },
  { bg: "bg-orange-100",  text: "text-orange-800",   border: "border-orange-300"  },
  { bg: "bg-teal-100",    text: "text-teal-800",     border: "border-teal-300"    },
];

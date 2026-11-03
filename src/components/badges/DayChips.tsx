import { KST_DAY_LABELS } from "@/lib/utils/date-kst";
import { cn } from "@/lib/utils/cn";

const TONE = {
  orange: "bg-orange-100 text-orange-700",
  sky: "bg-sky-100 text-sky-700",
} as const;

const SIZE = {
  sm: "h-5 min-w-[20px] px-1.5 text-[11px]",
  md: "px-2 py-0.5 text-xs",
} as const;

/** 요일(0=일 … 6=토) 번호 목록을 "월 화 수" 칩으로. 비어 있으면 `empty` 문구. */
export function DayChips({
  days,
  tone = "orange",
  size = "sm",
  empty = "요일 미지정",
}: {
  days: number[];
  tone?: keyof typeof TONE;
  size?: keyof typeof SIZE;
  empty?: string;
}) {
  if (days.length === 0) {
    return <span className="text-xs text-amber-600">{empty}</span>;
  }
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {[...days]
        .sort((a, b) => a - b)
        .map((d) => (
          <span
            key={d}
            className={cn(
              "inline-flex items-center justify-center rounded-full font-semibold",
              TONE[tone],
              SIZE[size]
            )}
          >
            {KST_DAY_LABELS[d]}
          </span>
        ))}
    </span>
  );
}

import { cn } from "@/lib/utils/cn";

const sizeMap = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
} as const;

export function Spinner({
  size = "md",
  className,
  label,
  srLabel = "로딩 중",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
  srLabel?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", label && "text-sm text-slate-600")}>
      <svg
        className={cn("animate-spin text-muted-foreground", sizeMap[size], className)}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {label ? <span>{label}</span> : null}
      <span className="sr-only">{srLabel}</span>
    </span>
  );
}

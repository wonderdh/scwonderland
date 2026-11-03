import { Loader2 } from "lucide-react";
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
      <Loader2
        className={cn("animate-spin text-muted-foreground", sizeMap[size], className)}
        aria-hidden="true"
      />
      {label ? <span>{label}</span> : null}
      <span className="sr-only">{srLabel}</span>
    </span>
  );
}

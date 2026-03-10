import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

export function LoadingState({
  label = "불러오는 중…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground", className)}>
      <Spinner size="md" />
      <span>{label}</span>
    </div>
  );
}

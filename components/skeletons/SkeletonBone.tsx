import { cn } from "@/lib/utils/cn";

export function SkeletonBone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-muted", className)} />;
}

import { cn } from "@/lib/utils/cn";

/** 필터 칩(선택됨 / 아님) 공통 className. 숙제·반·시리즈 필터에서 공유. */
export function filterChip(active: boolean, extra?: string) {
  return cn(
    "px-3 py-1 rounded-full text-xs font-medium transition-colors border",
    active
      ? "bg-primary text-primary-foreground border-primary shadow-sm"
      : "bg-white text-slate-700 border-slate-200 hover:border-primary/50 hover:text-primary",
    extra
  );
}

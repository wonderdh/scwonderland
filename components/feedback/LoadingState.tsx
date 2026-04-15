import { cn } from "@/lib/utils/cn";
import { Spinner } from "./Spinner";

export function LoadingState({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-10",
        className,
      )}
    >
      <Spinner size="md" srLabel={label} />
      <p className="text-base font-medium text-slate-700">{label}</p>
      <p className="text-sm text-slate-500">잠시만 기다려 주세요</p>
    </div>
  );
}

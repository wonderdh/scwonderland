function Bone({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className ?? ""}`} />;
}

export default function Loading() {
  return (
    <div className="space-y-4 p-6">
      <Bone className="h-9 w-48 rounded-md" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-3 space-y-2">
            <Bone className="h-[170px] w-full rounded" />
            <Bone className="h-4 w-full" />
            <Bone className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

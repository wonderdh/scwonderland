function Bone({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className ?? ""}`} />;
}

export default function Loading() {
  return (
    <div className="space-y-4 p-6">
      <div className="flex gap-3">
        <Bone className="h-9 w-40 rounded-md" />
        <Bone className="h-9 w-24 rounded-md" />
        <Bone className="h-9 w-24 rounded-md" />
      </div>
      <div className="rounded-lg border p-6 space-y-4">
        <Bone className="h-6 w-48" />
        <Bone className="h-32 w-full" />
        <Bone className="h-32 w-full" />
      </div>
    </div>
  );
}

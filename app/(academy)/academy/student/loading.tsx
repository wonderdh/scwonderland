function Bone({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className ?? ""}`} />;
}

export default function Loading() {
  return (
    <div className="space-y-4 p-6">
      {/* 프로필 카드 */}
      <div className="rounded-lg border p-6 space-y-3">
        <Bone className="h-6 w-32" />
        <Bone className="h-4 w-48" />
        <Bone className="h-4 w-40" />
      </div>
      <div className="rounded-lg border p-6 space-y-3">
        <Bone className="h-5 w-24" />
        <Bone className="h-4 w-56" />
      </div>
    </div>
  );
}

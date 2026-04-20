import { SkeletonBone as Bone } from "./SkeletonBone";

export function AdminDashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* 통계 카드 5개 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <Bone className="h-4 w-20" />
            <Bone className="h-8 w-16" />
          </div>
        ))}
      </div>
      {/* 네비 카드 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-6 space-y-2">
            <Bone className="h-5 w-24" />
            <Bone className="h-4 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

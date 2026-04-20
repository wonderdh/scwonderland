import { SkeletonBone as Bone } from "@/components/skeletons/SkeletonBone";

export default function Loading() {
  return (
    <div className="space-y-6 p-4">
      {/* 프로필 카드 (gradient top + avatar + name) */}
      <div className="rounded-xl border overflow-hidden bg-card">
        <div className="h-24 animate-pulse bg-gradient-to-r from-red-100 via-yellow-100 via-green-100 to-blue-100" />
        <div className="-mt-10 px-6 pb-6">
          <div className="flex items-end gap-4">
            <Bone className="size-16 rounded-full ring-4 ring-white" />
            <div className="pb-1 space-y-2">
              <Bone className="h-5 w-32" />
              <Bone className="h-4 w-24" />
            </div>
          </div>
        </div>
      </div>

      {/* 대시보드 위젯 3종 (미제출 숙제 · 출석률 · 최근 학습) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Bone className="h-4 w-20" />
              <Bone className="h-5 w-5 rounded-full" />
            </div>
            <Bone className="h-8 w-16" />
            <Bone className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* 반·교사 정보 카드 */}
      <div className="rounded-xl border p-6 space-y-4">
        <Bone className="h-5 w-24" />
        <div className="space-y-3">
          <Bone className="h-4 w-56" />
          <Bone className="h-4 w-40" />
        </div>
      </div>
    </div>
  );
}

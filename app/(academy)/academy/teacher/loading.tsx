import { SkeletonBone as Bone } from "@/components/skeletons/SkeletonBone";

export default function Loading() {
  return (
    <div className="space-y-6 p-4">
      {/* 교사 프로필 카드 (gradient + avatar + stats) */}
      <div className="rounded-xl border overflow-hidden bg-card">
        <div className="h-20 animate-pulse bg-gradient-to-r from-red-100 via-yellow-100 via-green-100 to-blue-100" />
        <div className="-mt-8 px-6 pb-6">
          <div className="flex items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <Bone className="size-14 rounded-full ring-4 ring-white" />
              <Bone className="h-5 w-28" />
            </div>
            <div className="flex gap-6 pb-1">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="rounded-lg border px-4 py-2 space-y-2">
                  <Bone className="h-6 w-8 mx-auto" />
                  <Bone className="h-3 w-12" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 담당 반 카드 그리드 (실제 page는 sm:grid-cols-2) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Bone className="h-5 w-24" />
              <Bone className="h-6 w-12 rounded-full" />
            </div>
            <Bone className="h-3 w-32" />
            <div className="pt-2 flex items-center gap-2">
              <Bone className="h-8 w-8 rounded-full" />
              <Bone className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { SkeletonBone as Bone } from "./SkeletonBone";

export function AdminListPageSkeleton() {
  return (
    <div className="flex h-full">
      {/* 사이드바 */}
      <div className="hidden w-72 shrink-0 border-r p-4 space-y-3 lg:block">
        <Bone className="h-9 w-full rounded-md" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <Bone className="h-4 w-28" />
            <Bone className="h-3 w-16" />
          </div>
        ))}
      </div>
      {/* 콘텐츠 */}
      <div className="flex-1 p-6 space-y-4">
        <Bone className="h-7 w-40" />
        {/* 탭 영역 (4탭: 기본/학습/시간표/승하차) */}
        <div className="flex gap-1 border-b bg-card rounded-t-xl overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-5 h-12 border-b-[3px] border-transparent">
              <Bone className="h-6 w-6 rounded-full" />
              <Bone className="h-4 w-20" />
            </div>
          ))}
        </div>
        {/* 탭 콘텐츠 플레이스홀더 */}
        <div className="rounded-lg border p-6 space-y-4">
          <Bone className="h-6 w-48" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Bone key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

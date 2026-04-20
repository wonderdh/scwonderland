import { SkeletonBone as Bone } from "./SkeletonBone";

export function SkeletonTable({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-4 p-6">
      {/* 탭 바 */}
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Bone key={i} className="h-9 w-24 rounded-md" />
        ))}
      </div>
      {/* 테이블 */}
      <div className="rounded-lg border">
        {/* 헤더 */}
        <div className="flex gap-4 border-b p-3">
          {Array.from({ length: cols }).map((_, i) => (
            <Bone key={i} className="h-4 flex-1" />
          ))}
        </div>
        {/* 행 */}
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 border-b p-3 last:border-0">
            {Array.from({ length: cols }).map((_, c) => (
              <Bone key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

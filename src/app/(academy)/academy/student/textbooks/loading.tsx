import { SkeletonBone as Bone } from "@/components/skeletons/SkeletonBone";

export default function Loading() {
  return (
    <div className="space-y-4 p-6">
      <Bone className="h-7 w-28" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-3 space-y-2">
            <Bone className="h-[190px] w-full rounded" />
            <Bone className="h-4 w-full" />
            <Bone className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

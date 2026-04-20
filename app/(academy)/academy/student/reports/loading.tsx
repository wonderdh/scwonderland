import { SkeletonBone as Bone } from "@/components/skeletons/SkeletonBone";

export default function Loading() {
  return (
    <div className="space-y-4 p-6">
      <Bone className="h-7 w-36" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <Bone className="h-5 w-32" />
            <Bone className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

import { SkeletonTable } from "@/components/skeletons/SkeletonTable";

export default function Loading() {
  return <SkeletonTable rows={8} cols={6} />;
}

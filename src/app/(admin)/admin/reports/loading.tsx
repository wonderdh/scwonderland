import { SkeletonTable } from "@/components/skeletons/SkeletonTable";

export default function Loading() {
  return <SkeletonTable rows={10} cols={4} />;
}

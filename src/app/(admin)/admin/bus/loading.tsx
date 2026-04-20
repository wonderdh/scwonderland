import { SkeletonTable } from "@/components/skeletons/SkeletonTable";

export default function Loading() {
  return <SkeletonTable rows={6} cols={5} />;
}

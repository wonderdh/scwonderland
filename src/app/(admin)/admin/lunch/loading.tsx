import { LoadingState } from "@/components/feedback/LoadingState";

export default function LunchLoading() {
  return (
    <div className="max-w-2xl mx-auto py-12">
      <LoadingState label="점심지도를 불러오는 중..." />
    </div>
  );
}

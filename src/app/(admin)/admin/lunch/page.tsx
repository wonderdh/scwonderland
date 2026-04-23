import Link from "next/link";
import { getLunchSchedule } from "@/app/(admin)/admin/actions";
import { LunchClient } from "./LunchClient";
import { PageHeader } from "@/components/navigation/PageHeader";
import { Button } from "@/components/ui/button";

type SearchParams = Promise<{ date?: string }>;

export const metadata = {
  title: "점심지도 | 관리자",
};

export default async function LunchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { date } = await searchParams;
  const { schedule, needsSetup } = await getLunchSchedule(date);

  if (needsSetup) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <PageHeader
          title="점심지도"
          description="7세·6세 점심시간 줄서기 순서와 리더를 자동으로 알려줍니다."
        />
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-lg font-semibold text-slate-700">
            먼저 점심지도 대상 반을 지정해주세요
          </p>
          <p className="mt-2 text-sm text-slate-500">
            유치부 6반 중 <b>7세반 2개 + 6세반 2개</b>를 선택하면 화면이 활성화됩니다.
          </p>
          <Link href="/admin/lunch/settings" className="mt-4 inline-block">
            <Button>설정 페이지로 이동</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <PageHeader title="점심지도" description="데이터를 불러올 수 없습니다." />
      </div>
    );
  }

  return <LunchClient schedule={schedule} />;
}

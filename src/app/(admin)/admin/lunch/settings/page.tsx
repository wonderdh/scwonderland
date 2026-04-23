import Link from "next/link";
import { listLunchGroupClasses } from "@/app/(admin)/admin/actions";
import { PageHeader } from "@/components/navigation/PageHeader";
import { Button } from "@/components/ui/button";
import { LunchSettingsClient } from "./LunchSettingsClient";

export const metadata = {
  title: "점심지도 설정 | 관리자",
};

export default async function LunchSettingsPage() {
  const classes = await listLunchGroupClasses();
  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-16">
      <div className="flex items-center justify-between">
        <PageHeader
          title="점심지도 설정"
          description="유치부 6반 중 점심지도 대상 4반(7세·6세 각 2반)을 지정합니다."
        />
        <Link href="/admin/lunch">
          <Button variant="ghost" size="sm">← 돌아가기</Button>
        </Link>
      </div>
      <LunchSettingsClient classes={classes} />
    </div>
  );
}

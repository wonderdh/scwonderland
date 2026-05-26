import { listAcademyClosedDays } from "@/app/(admin)/admin/actions";
import { PageHeader } from "@/components/navigation/PageHeader";
import { ClosedDaysClient } from "./_components/ClosedDaysClient";

export const metadata = {
  title: "쉬는날 | 관리자",
};

export default async function ClosedDaysPage() {
  const { days } = await listAcademyClosedDays();
  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-16">
      <PageHeader
        title="쉬는날"
        description="학원 공통 휴원일을 지정합니다. 지정된 날짜는 숙제 채점일 계산에서 자동으로 제외됩니다."
      />
      <ClosedDaysClient initialDays={days} />
    </div>
  );
}

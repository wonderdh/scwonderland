import { listAcademyNotices } from "../actions";
import { PageHeader } from "@/components/navigation/PageHeader";
import { AcademyNoticesManager } from "./components/AcademyNoticesManager";

export default async function AdminAcademyNoticesPage() {
  const initialNotices = await listAcademyNotices(true);

  return (
    <div className="space-y-6">
      <PageHeader
        title="포털 공지"
        description="학생·교사 포털에 표시되는 공지사항을 관리합니다."
      />
      <AcademyNoticesManager initialNotices={initialNotices} />
    </div>
  );
}

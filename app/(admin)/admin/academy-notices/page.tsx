import { PageHeader } from "@/components/PageHeader";
import { AcademyNoticesManager } from "./components/AcademyNoticesManager";

export default function AdminAcademyNoticesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="포털 공지"
        description="학생·교사 포털에 표시되는 공지사항을 관리합니다."
      />
      <AcademyNoticesManager />
    </div>
  );
}

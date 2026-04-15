import { listNotices } from "../actions/notice-actions";
import { PageHeader } from "@/components/navigation/PageHeader";
import { NoticesManager } from "./components/NoticesManager";

export default async function AdminNoticesPage() {
  const notices = await listNotices(true);

  return (
    <div className="flex flex-1 min-w-0 flex-col p-6 md:p-8">
      <PageHeader
        title="공개 공지사항"
        description="학원 사이트에 노출되는 공지사항을 관리합니다."
      />
      <NoticesManager initialNotices={notices} />
    </div>
  );
}

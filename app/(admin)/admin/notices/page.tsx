import { listNotices } from "../actions/notice-actions";
import { NoticesManager } from "./components/NoticesManager";

export default async function AdminNoticesPage() {
  const notices = await listNotices(true);

  return (
    <div className="flex flex-1 min-w-0 flex-col p-6 md:p-8">
      <NoticesManager initialNotices={notices} />
    </div>
  );
}

import { AcademyNoticesManager } from "./components/AcademyNoticesManager";

export default function AdminAcademyNoticesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Academy 공지 관리</h1>
      </div>
      <AcademyNoticesManager />
    </div>
  );
}

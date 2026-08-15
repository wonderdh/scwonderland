import { getAllReadingStats } from "../actions/raz-actions";
import { ReadingDashboard } from "@/components/reading/ReadingDashboard";

export default async function AdminReading2Page() {
  const stats = await getAllReadingStats();

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">Raz 리딩2</h1>
      <ReadingDashboard stats={stats} hrefBase="/admin/reading2" />
    </div>
  );
}

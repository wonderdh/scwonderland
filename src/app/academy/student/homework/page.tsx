import { redirect } from "next/navigation";
import { getCurrentStudentProfile } from "../../actions";
import { listUnitProgressByStudent } from "@/app/(admin)/admin/actions/homework-unit-actions";
import { UnitProgressGrid } from "@/components/homework/UnitProgressGrid";
import { BookOpen } from "lucide-react";

export default async function StudentHomeworkPage() {
  const profile = await getCurrentStudentProfile();
  if (!profile) redirect("/login");

  const data = await listUnitProgressByStudent(profile.id);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">내 숙제</h1>

      {data.textbooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <BookOpen className="size-16 text-slate-200" strokeWidth={1} />
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">
              아직 부여된 숙제가 없습니다.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              선생님 또는 관리자에게 문의하세요.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {data.textbooks.map((tb) => (
            <UnitProgressGrid
              key={tb.id}
              textbook={tb}
              units={tb.units}
              editable={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

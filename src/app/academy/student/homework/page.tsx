import { redirect } from "next/navigation";
import { getCurrentStudentProfile } from "../../actions";
import { listUnitProgressByStudent } from "@/app/(admin)/admin/actions";
import { UnitProgressGrid } from "@/components/homework/UnitProgressGrid";

export default async function StudentHomeworkPage() {
  const profile = await getCurrentStudentProfile();
  if (!profile) redirect("/academy/login");

  const data = await listUnitProgressByStudent(profile.id);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">내 숙제</h1>

      {data.textbooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <svg
            className="size-16 text-slate-200"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
            />
          </svg>
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

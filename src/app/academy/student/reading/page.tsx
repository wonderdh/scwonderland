import { redirect } from "next/navigation";
import { getCurrentStudentProfile, getReadBookIds, toggleRazRead } from "../../actions";
import { getRazBooks } from "@/lib/raz/books.server";
import { BookGrid } from "@/components/reading/BookGrid";

export default async function StudentReadingPage() {
  const profile = await getCurrentStudentProfile();
  if (!profile) redirect("/login");

  const [books, readBookIds] = await Promise.all([getRazBooks(), getReadBookIds(profile.id)]);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-800">Raz 리딩</h1>
      <BookGrid
        books={books}
        readBookIds={readBookIds}
        toggleAction={toggleRazRead.bind(null, profile.id)}
      />
    </div>
  );
}

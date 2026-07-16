import { Hero } from "./_components/sections/Hero";
import { MainProgram } from "./_components/sections/MainProgram";
import { WeeklySentencePopup } from "./_components/sections/WeeklySentencePopup";
import { getCurrentWeeklySentences } from "@/app/(admin)/admin/actions/weekly-sentence-actions";

export default async function Home() {
  const weekly = await getCurrentWeeklySentences();

  return (
    <main className="min-h-screen bg-white">
      <Hero />
      <MainProgram />
      {weekly && <WeeklySentencePopup data={weekly} />}
    </main>
  );
}

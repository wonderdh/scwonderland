import { Hero } from "./_components/sections/Hero";
import { MainProgram } from "./_components/sections/MainProgram";

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <Hero />
      <MainProgram />
    </main>
  );
}

import { Hero } from "./components/sections/Hero";
import { MainProgram } from "./components/sections/MainProgram";

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <Hero />
      <MainProgram />
    </main>
  );
}

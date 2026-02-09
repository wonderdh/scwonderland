import { Hero } from "./components/sections/Hero";
import { SideBar } from "./components/sections/SideBar";

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <SideBar />
      <Hero />
      <footer className="bg-gray-900 py-8 text-white">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm">
            &copy; 2026 원더랜드 영어학원. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}

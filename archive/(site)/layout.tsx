import { Navigation } from "./_components/layout/Navigation";
import { Footer } from "./_components/layout/Footer";
import { SideBar } from "./_components/sections/SideBar";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navigation />
      <SideBar />
      {children}
      <Footer />
    </>
  );
}

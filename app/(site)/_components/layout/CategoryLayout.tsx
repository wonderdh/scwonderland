"use client";

import { usePathname } from "next/navigation";
import { SubNav } from "./SubNav";

type CategoryLayoutProps = {
  menuId: string;
  categoryTitle: string;
  children: React.ReactNode;
};

export function CategoryLayout({
  menuId,
  categoryTitle,
  children,
}: CategoryLayoutProps) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const currentSlug = segments[1] ?? "";

  return (
    <>
      <SubNav
        categoryTitle={categoryTitle}
        menuId={menuId}
        currentSlug={currentSlug}
      />
      {children}
    </>
  );
}

"use client";

import Link from "next/link";
import {
  getCategoryItemLabels,
  getMenuItemHref,
  itemSlugs,
} from "@/lib/menu-routes";

type SubNavProps = {
  categoryTitle: string;
  menuId: string;
  currentSlug: string;
};

export function SubNav({
  categoryTitle,
  menuId,
  currentSlug,
}: SubNavProps) {
  const items = getCategoryItemLabels(menuId);
  const slugs = itemSlugs[menuId];
  if (!slugs || items.length === 0) return null;

  return (
    <header className="relative scroll-mt-24 border-b border-gray-200 bg-gray-50/80">
      <div
        className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=20&w=800')] bg-cover bg-center opacity-[0.06]"
        aria-hidden
      />
      <div className="container relative mx-auto px-4 py-8">
        <h1 className="mb-8 text-center text-4xl font-bold text-gray-900 md:text-5xl">
          {categoryTitle}
        </h1>
        <nav
          className="flex flex-wrap items-center justify-center gap-8 md:gap-14"
          aria-label="하위 메뉴"
        >
          {items.map((label) => {
            const slug = slugs[label];
            const isActive = slug === currentSlug;
            const href = getMenuItemHref(menuId, label);
            return (
              <Link
                key={label}
                href={href}
                className={`relative pb-2 text-lg font-medium transition ${
                  isActive
                    ? "text-green-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {label}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600"
                    aria-hidden
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

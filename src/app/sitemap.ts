import type { MetadataRoute } from "next";
import { menuIdToPath, itemSlugs } from "@/lib/navigation/menu-routes";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://scwonderland.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
  ];

  for (const [menuId, slugMap] of Object.entries(itemSlugs)) {
    const pathPrefix = menuIdToPath[menuId];
    if (!pathPrefix) continue;
    for (const slug of Object.values(slugMap)) {
      staticPages.push({
        url: `${BASE_URL}/${pathPrefix}/${slug}`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  }

  return staticPages;
}

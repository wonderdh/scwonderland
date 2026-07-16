import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://scwonderland.com";

// 마케팅 사이트((site))는 archive/ 로 이동해 비활성 — 루트만 노출
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
  ];
}

/**
 * 메뉴 ID → URL 경로 prefix (About Wonderland → about-wonderland)
 */
export const menuIdToPath: Record<string, string> = {
  about: "about-wonderland",
  programs: "program",
  features: "notice",
  gallery: "community",
  contact: "experience",
};

/**
 * 메뉴 ID → 섹션 제목 (페이지 상단 표시용)
 */
export const menuIdToLabel: Record<string, string> = {
  about: "About Wonderland",
  programs: "Program",
  features: "Notice",
  gallery: "Community",
  contact: "Experience",
};

/**
 * 메뉴별 아이템 라벨 → 영어 slug (URL용)
 */
export const itemSlugs: Record<string, Record<string, string>> = {
  about: {
    인사말: "greeting",
    회사연혁: "company-history",
    "대외기관 인증": "certification",
    Wonderland: "wonderland",
  },
  programs: {
    MAP: "map",
    Wonderland: "wonderland",
    "Wonder K": "wonder-k",
    "Primo Class": "primo-school",
    "Quest Class": "quest-academy",
  },
  features: {
    News: "news",
  },
  gallery: {
    캠퍼스: "campus",
  },
  contact: {
    "Special Day": "special-day",
    "Wonderland E-Learning": "e-school",
    Library: "library",
    Links: "links",
  },
};

/**
 * 드롭다운 메뉴 아이템 클릭 시 이동할 경로 반환
 * e.g. getMenuItemHref("about", "인사말") → "/about-wonderland/greeting"
 */
export function getMenuItemHref(menuId: string, itemLabel: string): string {
  const path = menuIdToPath[menuId];
  const slug = itemSlugs[menuId]?.[itemLabel];
  if (!path || !slug) return "/";
  return `/${path}/${slug}`;
}

/**
 * 메뉴별 첫 번째 아이템 경로 (상단 메뉴 클릭 시 이동)
 */
export function getDefaultMenuItemHref(menuId: string): string | null {
  const items = itemSlugs[menuId];
  if (!items) return null;
  const firstSlug = Object.values(items)[0];
  const path = menuIdToPath[menuId];
  if (!path || !firstSlug) return null;
  return `/${path}/${firstSlug}`;
}

/**
 * 해당 카테고리(메뉴)의 하위 아이템 라벨 목록 (보조 네비 순서)
 */
export function getCategoryItemLabels(menuId: string): string[] {
  const slugs = itemSlugs[menuId];
  if (!slugs) return [];
  return Object.keys(slugs);
}

/**
 * 현재 pathname에 해당하는 메뉴 ID 반환 (네비게이션 하이라이트용)
 * e.g. "/program/map" → "programs", "/" → "about"
 */
export function getMenuIdFromPathname(pathname: string): string | null {
  if (pathname === "/") return "about";
  const segment = pathname.split("/")[1];
  if (!segment) return null;
  const entry = Object.entries(menuIdToPath).find(([, path]) => path === segment);
  return entry ? entry[0] : null;
}

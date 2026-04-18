const ORDER = [
  {
    slug: "ai-prompts-no-distribution",
    href: "/blogs/ai-prompts-no-distribution",
  },
  {
    slug: "introducing-blogs",
    href: "/blogs/introducing-blogs",
  },
] as const;

export const BLOG_ROUTE_ORDER: string[] = ORDER.map((entry) => entry.href);

const BLOG_ROUTE_BY_SLUG = new Map<string, string>(
  ORDER.map((entry) => [entry.slug, entry.href] as [string, string]),
);

export function getBlogHrefForSlug(slug: string) {
  return BLOG_ROUTE_BY_SLUG.get(slug) ?? "/blogs";
}

export function isKnownBlogSlug(slug: string) {
  return BLOG_ROUTE_BY_SLUG.has(slug);
}

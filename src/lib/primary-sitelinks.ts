/**
 * Ordered list of key destinations for internal linking + JSON-LD.
 * Helps search engines infer site hierarchy (Google sitelinks are algorithmic; this strengthens signals).
 */
export const PRIMARY_SITELINK_NAV = [
  { name: "Marketplace", path: "/marketplace" },
  { name: "Workflow Studio", path: "/builder" },
  { name: "Prompt Studio", path: "/prompt-studio" },
  { name: "Documentation", path: "/docs" },
  { name: "Pricing", path: "/pricing" },
  { name: "Creator Program", path: "/creators" },
  { name: "Help", path: "/help" },
  { name: "Blog", path: "/blogs" },
] as const;

export const ORGANIZATION_SAME_AS = [
  "https://x.com/edgaze_ai",
  "https://github.com/edgaze-ai",
  "https://www.linkedin.com/company/edgaze-ai/",
] as const;

export function buildPrimarySitelinksItemList(siteOrigin: string) {
  return {
    "@type": "ItemList",
    "@id": `${siteOrigin}/#primary-sitelinks`,
    name: "Primary pages",
    description: "Main destinations linked from sitewide navigation and footer.",
    numberOfItems: PRIMARY_SITELINK_NAV.length,
    itemListElement: PRIMARY_SITELINK_NAV.map((entry, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: entry.name,
      item: {
        "@type": "WebPage",
        "@id": `${siteOrigin}${entry.path}`,
        url: `${siteOrigin}${entry.path}`,
        name: entry.name,
      },
    })),
  };
}

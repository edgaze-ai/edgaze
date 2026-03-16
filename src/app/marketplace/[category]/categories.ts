export const MARKETPLACE_CATEGORIES = [
  "ai-agents",
  "marketing",
  "startups",
  "chatgpt",
  "automation",
  "productivity",
  "writing",
  "coding",
] as const;

export type MarketplaceCategorySlug = (typeof MARKETPLACE_CATEGORIES)[number];

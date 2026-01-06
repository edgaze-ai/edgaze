export type Visibility = "public" | "unlisted" | "private";

export type MonetisationMode =
  | "free"
  | "paywall"
  | "subscription"
  | "paywall+subscription";

export type PublishMeta = {
  name: string;
  description: string;
  thumbnailUrl?: string;
  tags: string;
  visibility: Visibility;
  priceUsd?: number;
};

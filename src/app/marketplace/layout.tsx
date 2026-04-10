import type { Metadata } from "next";
import { DEFAULT_SOCIAL_IMAGE } from "@lib/default-social-image";

export const metadata: Metadata = {
  title: "Marketplace",
  description:
    "Discover AI prompts and workflows on Edgaze. Browse, run, and buy prompts and automation built by creators. One link to share, one tap to run.",
  openGraph: {
    title: "Marketplace",
    description:
      "Discover AI prompts and workflows on Edgaze. Browse, run, and buy prompts and automation built by creators.",
    url: "https://edgaze.ai/marketplace",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Marketplace",
    description:
      "Discover AI prompts and workflows on Edgaze. Browse, run, and buy prompts and automation built by creators.",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

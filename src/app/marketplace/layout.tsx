import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketplace",
  description:
    "Discover AI prompts and workflows on Edgaze. Browse, run, and buy prompts and automation built by creators. One link to share, one tap to run.",
  openGraph: {
    title: "Marketplace | Edgaze",
    description:
      "Discover AI prompts and workflows on Edgaze. Browse, run, and buy prompts and automation built by creators.",
    url: "https://edgaze.ai/marketplace",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Marketplace | Edgaze",
    description:
      "Discover AI prompts and workflows on Edgaze. Browse, run, and buy prompts and automation built by creators.",
    images: ["/og.png"],
  },
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

import type { Metadata } from "next";
import { buildMetadata } from "../../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "AI Prompts and Workflows Marketplace | Edgaze",
  description:
    "Explore public AI prompts, workflows, and creator built tools in the Edgaze marketplace. Compare listings, discover creators, and open useful runnable products from one place.",
  path: "/marketplace",
});

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

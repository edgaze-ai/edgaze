import type { Metadata } from "next";
import PublicContentPage from "../../components/layout/PublicContentPage";
import { getPublicContextPage } from "../../lib/public-site-pages";
import { buildCanonicalUrl, buildMetadata, NOINDEX_ROBOTS } from "../../lib/seo";

const page = getPublicContextPage("/ai-workflow-marketplace");

const baseMetadata = buildMetadata({
  title: page?.title ?? "AI Prompts and Workflows Marketplace | Edgaze",
  description: page?.description ?? "About the Edgaze marketplace.",
  path: "/ai-workflow-marketplace",
  robots: NOINDEX_ROBOTS,
});

export const metadata: Metadata = {
  ...baseMetadata,
  alternates: {
    canonical: buildCanonicalUrl("/marketplace"),
  },
  openGraph: {
    ...baseMetadata.openGraph,
    url: buildCanonicalUrl("/marketplace"),
  },
};

export default function AiWorkflowMarketplacePage() {
  if (!page) return null;
  return <PublicContentPage page={page} />;
}

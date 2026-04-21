import type { Metadata } from "next";
import PublicContentPage from "../../components/layout/PublicContentPage";
import { getPublicContextPage } from "../../lib/public-site-pages";
import { buildCanonicalUrl, buildMetadata, NOINDEX_ROBOTS } from "../../lib/seo";

const page = getPublicContextPage("/run-ai-workflows");

const baseMetadata = buildMetadata({
  title: page?.title ?? "Run AI Workflows | Edgaze",
  description: page?.description ?? "How to run AI workflows on Edgaze.",
  path: "/run-ai-workflows",
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

export default function RunAiWorkflowsPage() {
  if (!page) return null;
  return <PublicContentPage page={page} />;
}

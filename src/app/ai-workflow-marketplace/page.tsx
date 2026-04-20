import type { Metadata } from "next";
import PublicContentPage from "../../components/layout/PublicContentPage";
import { getPublicContextPage } from "../../lib/public-site-pages";
import { buildMetadata } from "../../lib/seo";

const page = getPublicContextPage("/ai-workflow-marketplace");

export const metadata: Metadata = buildMetadata({
  title: page?.title ?? "AI Prompts and Workflows Marketplace | Edgaze",
  description: page?.description ?? "About the Edgaze marketplace.",
  path: "/ai-workflow-marketplace",
});

export default function AiWorkflowMarketplacePage() {
  if (!page) return null;
  return <PublicContentPage page={page} />;
}

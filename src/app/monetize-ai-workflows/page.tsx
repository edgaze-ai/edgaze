import type { Metadata } from "next";
import PublicContentPage from "../../components/layout/PublicContentPage";
import { getPublicContextPage } from "../../lib/public-site-pages";
import { buildMetadata } from "../../lib/seo";

const page = getPublicContextPage("/monetize-ai-workflows");

export const metadata: Metadata = buildMetadata({
  title: page?.title ?? "Monetize AI Workflows | Edgaze",
  description: page?.description ?? "How creators monetize on Edgaze.",
  path: "/monetize-ai-workflows",
});

export default function MonetizeAiWorkflowsPage() {
  if (!page) return null;
  return <PublicContentPage page={page} />;
}

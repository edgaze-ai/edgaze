import type { Metadata } from "next";
import PublicContentPage from "../../components/layout/PublicContentPage";
import { getPublicContextPage } from "../../lib/public-site-pages";
import { buildMetadata } from "../../lib/seo";

const page = getPublicContextPage("/run-ai-workflows");

export const metadata: Metadata = buildMetadata({
  title: page?.title ?? "Run AI Workflows | Edgaze",
  description: page?.description ?? "How to run AI workflows on Edgaze.",
  path: "/run-ai-workflows",
});

export default function RunAiWorkflowsPage() {
  if (!page) return null;
  return <PublicContentPage page={page} />;
}

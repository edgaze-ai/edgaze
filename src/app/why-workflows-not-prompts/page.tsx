import type { Metadata } from "next";
import PublicContentPage from "../../components/layout/PublicContentPage";
import { getPublicContextPage } from "../../lib/public-site-pages";
import { buildMetadata } from "../../lib/seo";

const page = getPublicContextPage("/why-workflows-not-prompts");

export const metadata: Metadata = buildMetadata({
  title: page?.title ?? "Why Workflows, Not Prompts? | Edgaze",
  description: page?.description ?? "Why workflows matter on Edgaze.",
  path: "/why-workflows-not-prompts",
});

export default function WhyWorkflowsNotPromptsPage() {
  if (!page) return null;
  return <PublicContentPage page={page} />;
}

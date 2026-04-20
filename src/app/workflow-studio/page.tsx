import type { Metadata } from "next";
import PublicContentPage from "../../components/layout/PublicContentPage";
import { getPublicContextPage } from "../../lib/public-site-pages";
import { buildMetadata } from "../../lib/seo";

const page = getPublicContextPage("/workflow-studio");

export const metadata: Metadata = buildMetadata({
  title: page?.title ?? "Workflow Studio | Edgaze",
  description: page?.description ?? "Learn about Workflow Studio.",
  path: "/workflow-studio",
});

export default function WorkflowStudioPage() {
  if (!page) return null;
  return <PublicContentPage page={page} />;
}

import type { Metadata } from "next";
import { templateService } from "../../lib/templates";
import TemplateLibraryPageClient from "../../components/templates/TemplateLibraryPageClient";
import { buildMetadata } from "../../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "AI Workflow Templates | Edgaze",
  description:
    "Browse outcome-driven workflow templates on Edgaze, preview graph structure, and open editable workflow starters inside Workflow Studio.",
  path: "/templates",
});

export default async function TemplatesPage() {
  const templates = await templateService.listTemplates();
  return <TemplateLibraryPageClient templates={templates} />;
}

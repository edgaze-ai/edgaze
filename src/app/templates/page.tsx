import type { Metadata } from "next";
import { DEFAULT_SOCIAL_IMAGE } from "@lib/default-social-image";
import { templateService } from "@/lib/templates";
import TemplateLibraryPageClient from "@/components/templates/TemplateLibraryPageClient";

export const metadata: Metadata = {
  title: "Workflow Templates",
  description:
    "Browse Edgaze workflow templates, preview the graph structure, and start from guided outcomes instead of raw nodes.",
  openGraph: {
    title: "Workflow Templates",
    description:
      "Browse Edgaze workflow templates, preview the graph structure, and start from guided outcomes instead of raw nodes.",
    url: "https://edgaze.ai/templates",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
};

export default async function TemplatesPage() {
  const templates = await templateService.listTemplates();
  return <TemplateLibraryPageClient templates={templates} />;
}

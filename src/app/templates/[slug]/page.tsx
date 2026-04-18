import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DEFAULT_SOCIAL_IMAGE } from "@lib/default-social-image";
import { templateService } from "@/lib/templates";
import TemplateDetailPageClient from "@/components/templates/TemplateDetailPageClient";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const template = await templateService.getTemplateBySlug(slug);
  if (!template) {
    return { title: "Template not found" };
  }

  return {
    title: `${template.meta.name} Template`,
    description: template.meta.shortDescription,
    openGraph: {
      title: `${template.meta.name} Template`,
      description: template.meta.shortDescription,
      images: [DEFAULT_SOCIAL_IMAGE],
    },
  };
}

export default async function TemplateDetailPage({ params }: Props) {
  const { slug } = await params;
  const template = await templateService.getTemplateBySlug(slug);
  if (!template) notFound();
  return <TemplateDetailPageClient template={template} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { templateService } from "../../../lib/templates";
import TemplateDetailPageClient from "../../../components/templates/TemplateDetailPageClient";
import { buildBreadcrumbJsonLd, buildMetadata, NOINDEX_ROBOTS } from "../../../lib/seo";
import { sanitizeJsonScriptContent } from "../../../lib/security/url-policy";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const template = await templateService.getTemplateBySlug(slug);
  if (!template) {
    return buildMetadata({
      title: "Template not found | Edgaze",
      description: "The requested workflow template could not be found.",
      path: `/templates/${slug}`,
      robots: NOINDEX_ROBOTS,
    });
  }

  return buildMetadata({
    title: `${template.meta.name} Template | Edgaze`,
    description: template.meta.shortDescription,
    path: `/templates/${template.slug}`,
  });
}

export default async function TemplateDetailPage({ params }: Props) {
  const { slug } = await params;
  const template = await templateService.getTemplateBySlug(slug);
  if (!template) notFound();
  const relatedTemplates = (await templateService.listTemplates())
    .filter((item) => item.slug !== template.slug)
    .filter(
      (item) =>
        item.meta.category === template.meta.category ||
        item.meta.tags.some((tag) => template.meta.tags.includes(tag)),
    )
    .slice(0, 3);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Templates", path: "/templates" },
    { name: template.meta.name, path: `/templates/${template.slug}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: sanitizeJsonScriptContent(breadcrumbJsonLd) }}
      />
      <TemplateDetailPageClient template={template} relatedTemplates={relatedTemplates} />
    </>
  );
}

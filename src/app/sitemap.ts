import type { MetadataRoute } from "next";
import { getAllBlogs, getBlog } from "./blogs/utils/blogs";
import { getAllDocs, getDoc } from "./docs/utils/docs";
import { templateService } from "../lib/templates/templateService";
import { buildCanonicalUrl, hasMeaningfulTextContent } from "../lib/seo";
import { PUBLIC_CONTEXT_PAGES } from "../lib/public-site-pages";

function docPathFromSlug(slug: string) {
  return slug === "builder" ? "/docs/builder" : `/docs/${slug}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes = [
    "/",
    "/marketplace",
    "/builder",
    "/prompt-studio",
    "/help",
    "/docs",
    "/templates",
    "/creators",
    "/blogs",
    "/about",
    "/contact",
    "/pricing",
    "/careers",
    ...PUBLIC_CONTEXT_PAGES.map((page) => page.path),
  ];

  const docsEntries = getAllDocs()
    .map((doc) => ({ meta: doc, full: getDoc(doc.slug) }))
    .filter(
      (entry) =>
        entry.full &&
        hasMeaningfulTextContent(entry.full.body, 160) &&
        hasMeaningfulTextContent(entry.meta.description, 40),
    )
    .map((entry) => ({
      url: buildCanonicalUrl(docPathFromSlug(entry.meta.slug)),
      lastModified: now,
    }));

  const blogEntries = getAllBlogs()
    .map((blog) => ({ meta: blog, full: getBlog(blog.slug) }))
    .filter(
      (entry) =>
        entry.full &&
        hasMeaningfulTextContent(entry.full.body, 160) &&
        hasMeaningfulTextContent(entry.meta.description, 40),
    )
    .map((entry) => ({
      url: buildCanonicalUrl(`/blogs/${entry.meta.slug}`),
      lastModified: entry.meta.date ? new Date(entry.meta.date) : now,
    }));

  const templates = await templateService.listTemplates();
  const templateEntries = templates
    .filter(
      (template) =>
        hasMeaningfulTextContent(template.meta.shortDescription, 40) &&
        hasMeaningfulTextContent(template.meta.longDescription, 120),
    )
    .map((template) => ({
      url: buildCanonicalUrl(`/templates/${template.slug}`),
      lastModified: now,
    }));

  return [
    ...staticRoutes.map((path) => ({
      url: buildCanonicalUrl(path),
      lastModified: now,
    })),
    ...docsEntries,
    ...blogEntries,
    ...templateEntries,
  ];
}

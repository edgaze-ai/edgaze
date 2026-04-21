import { NextResponse } from "next/server";
import { getAllBlogs, getBlog } from "../../blogs/utils/blogs";
import { getAllDocs, getDoc } from "../../docs/utils/docs";
import { buildCanonicalUrl, hasMeaningfulTextContent } from "../../../lib/seo";
import { getIndexablePublicContextPages } from "../../../lib/public-site-pages";
import { templateService } from "../../../lib/templates/templateService";

export const runtime = "nodejs";
export const revalidate = 1800;

function docPathFromSlug(slug: string) {
  return slug === "builder" ? "/docs/builder" : `/docs/${slug}`;
}

export async function GET() {
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
    ...getIndexablePublicContextPages().map((page) => page.path),
  ];

  const docs = getAllDocs()
    .map((doc) => ({ meta: doc, full: getDoc(doc.slug) }))
    .filter(
      (entry) =>
        entry.full &&
        hasMeaningfulTextContent(entry.full.body, 160) &&
        hasMeaningfulTextContent(entry.meta.description, 40),
    )
    .map((entry) => docPathFromSlug(entry.meta.slug));

  const blogs = getAllBlogs()
    .map((blog) => ({ meta: blog, full: getBlog(blog.slug) }))
    .filter(
      (entry) =>
        entry.full &&
        hasMeaningfulTextContent(entry.full.body, 160) &&
        hasMeaningfulTextContent(entry.meta.description, 40),
    )
    .map((entry) => `/blogs/${entry.meta.slug}`);

  const templates = await templateService.listTemplates();
  const templatePaths = templates
    .filter(
      (template) =>
        hasMeaningfulTextContent(template.meta.shortDescription, 40) &&
        hasMeaningfulTextContent(template.meta.longDescription, 120),
    )
    .map((template) => `/templates/${template.slug}`);

  const urls = Array.from(new Set([...staticRoutes, ...docs, ...blogs, ...templatePaths])).map(
    (path) => buildCanonicalUrl(path),
  );

  return NextResponse.json({ urls }, { status: 200 });
}

import { redirect } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import DocRenderer from "../components/DocRenderer";
import DocTOC from "../components/DocTOC";
import { CopyMarkdownButton } from "../components/CopyMarkdownButton";
import { getAllDocs, getDoc } from "../utils/docs";
import { extractToc } from "../utils/extractToc";
import { normalizeSafeSlug } from "../../../lib/security/safe-values";
import { sanitizeDocPath, sanitizeJsonScriptContent } from "../../../lib/security/url-policy";
import { buildBreadcrumbJsonLd, buildMetadata } from "../../../lib/seo";

function docPathFromSlug(slug: string) {
  const encodedSlug = normalizeSafeSlug(slug, { allowSlash: true, maxLength: 120 })
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  if (!encodedSlug) return "/docs";
  return sanitizeDocPath(encodedSlug === "builder" ? "/docs/builder" : `/docs/${encodedSlug}`);
}

export const metadata: Metadata = buildMetadata({
  title: "Builder Documentation | Edgaze Docs",
  description:
    "Learn how Workflow Studio, Prompt Studio, templates, and API Vault features work inside Edgaze Builder.",
  path: "/docs/builder",
  openGraphType: "article",
});

export default async function BuilderDocPage() {
  const doc = getDoc("builder");

  if (!doc) {
    redirect("/docs/changelog");
    return null;
  }

  const toc = extractToc(doc.body);
  const relatedDocs = getAllDocs()
    .filter((item) => item.slug !== "builder")
    .filter((item) => item.category === "builder")
    .slice(0, 3);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Docs", path: "/docs" },
    { name: "Builder", path: "/docs/builder" },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: sanitizeJsonScriptContent(breadcrumbJsonLd) }}
      />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-10">
        <article className="min-w-0">
          <header className="pb-6 border-b border-white/10 flex flex-col gap-3 sm:gap-4">
            <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-white/95">
              {doc.title}
            </h1>
            {doc.description ? (
              <p className="text-sm sm:text-base text-white/55 leading-6 max-w-2xl">
                {doc.description}
              </p>
            ) : null}
            <div className="pt-1">
              <CopyMarkdownButton title={doc.title} body={doc.body} />
            </div>
          </header>

          <div className="pt-6">
            <DocRenderer content={doc.body} />
          </div>

          <section className="mt-12 border-t border-white/10 pt-10">
            <h2 className="text-2xl font-semibold text-white">Builder guides to read next</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {relatedDocs.map((item) => (
                <Link
                  key={item.slug}
                  href={docPathFromSlug(item.slug)}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:bg-white/[0.05]"
                >
                  <div className="text-base font-semibold text-white">{item.title}</div>
                  <p className="mt-2 text-sm leading-6 text-white/60">{item.description}</p>
                </Link>
              ))}
            </div>
          </section>
        </article>

        <DocTOC items={toc} />
      </div>
    </>
  );
}

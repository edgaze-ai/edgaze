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

  return sanitizeDocPath(encodedSlug === "builder" ? "/docs/builder" : `/docs/${encodedSlug}`);
}

export function generateStaticParams() {
  return getAllDocs()
    .filter((doc) => !doc.slug.includes("/"))
    .map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDoc(slug);

  if (!doc) {
    return buildMetadata({
      title: "Documentation | Edgaze",
      description: "Browse Edgaze documentation.",
      path: "/docs",
      robots: { index: false, follow: false },
    });
  }

  return buildMetadata({
    title: `${doc.title} | Edgaze Docs`,
    description: doc.description || `Learn about ${doc.title} on Edgaze.`,
    path: docPathFromSlug(doc.slug),
    openGraphType: "article",
  });
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug.includes("/")) {
    redirect(docPathFromSlug(slug));
  }
  const doc = getDoc(slug);

  if (!doc) {
    // If it's a builder route, try redirecting
    if (slug === "builder") {
      redirect("/docs/builder");
      return null;
    }
    redirect("/docs/changelog");
    return null;
  }

  const toc = extractToc(doc.body);
  const relatedDocs = getAllDocs()
    .filter((item) => item.slug !== doc.slug)
    .filter((item) => (doc.category ? item.category === doc.category : true))
    .slice(0, 3);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Docs", path: "/docs" },
    { name: doc.title, path: docPathFromSlug(doc.slug) },
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
            <h2 className="text-2xl font-semibold text-white">Related documentation</h2>
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

            <div className="mt-8 flex flex-wrap gap-4 text-sm text-white/72">
              <Link href="/builder" className="hover:text-white">
                Open Workflow Builder
              </Link>
              <Link href="/prompt-studio" className="hover:text-white">
                Explore Prompt Studio
              </Link>
              <Link href="/templates" className="hover:text-white">
                Browse workflow templates
              </Link>
              <Link href="/marketplace" className="hover:text-white">
                Visit the marketplace
              </Link>
              <Link href="/creators" className="hover:text-white">
                Learn about creators
              </Link>
            </div>
          </section>
        </article>

        <DocTOC items={toc} />
      </div>
    </>
  );
}

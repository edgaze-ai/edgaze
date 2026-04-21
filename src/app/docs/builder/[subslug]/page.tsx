import { redirect } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import DocRenderer from "../../components/DocRenderer";
import DocTOC from "../../components/DocTOC";
import { CopyMarkdownButton } from "../../components/CopyMarkdownButton";
import { getAllDocs, getDoc } from "../../utils/docs";
import { extractToc } from "../../utils/extractToc";
import { normalizeSafeSlug } from "../../../../lib/security/safe-values";
import { sanitizeDocPath, sanitizeJsonScriptContent } from "../../../../lib/security/url-policy";
import { buildBreadcrumbJsonLd, buildMetadata } from "../../../../lib/seo";

function docPathFromSlug(slug: string) {
  const encodedSlug = normalizeSafeSlug(slug, { allowSlash: true, maxLength: 120 })
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  if (!encodedSlug) return "/docs";
  return sanitizeDocPath(encodedSlug === "builder" ? "/docs/builder" : `/docs/${encodedSlug}`);
}

export function generateStaticParams() {
  return [
    { subslug: "workflow-studio" },
    { subslug: "prompt-studio" },
    { subslug: "templates" },
    { subslug: "api-vault" },
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subslug: string }>;
}): Promise<Metadata> {
  const { subslug } = await params;
  const slug = `builder/${subslug}`;
  const doc = getDoc(slug);

  if (!doc) {
    return buildMetadata({
      title: "Builder Documentation | Edgaze Docs",
      description: "Learn how to use Edgaze builder tools.",
      path: "/docs/builder",
      robots: { index: false, follow: false },
    });
  }

  const titleMap: Record<string, string> = {
    "workflow-studio": "Workflow Studio Guide | Build AI Workflows Step by Step",
    "prompt-studio": "Prompt Studio Guide | Create Reusable AI Prompts",
    templates: "Templates Guide | Start From Outcomes Instead of Raw Graphs",
    "api-vault": "API Vault Guide | Connect Provider Keys Safely in Edgaze",
  };

  const descMap: Record<string, string> = {
    "workflow-studio":
      "Learn Workflow Studio from the ground up, including blocks, canvas layout, runs, publishing, and how to build reliable AI workflows without touching code.",
    "prompt-studio":
      "Learn Prompt Studio from first principles, including placeholders, testing, publishing, and how to package great prompts for real customers.",
    templates:
      "Learn how Edgaze templates work, how guided setup flows turn answers into editable workflows, and when to start from a template instead of a blank builder canvas.",
    "api-vault":
      "Learn how the Edgaze API Vault works, how to connect provider keys, and how vault-backed execution behaves inside Workflow Studio and runtime surfaces.",
  };

  return buildMetadata({
    title: titleMap[subslug] || `${doc.title} | Edgaze Docs`,
    description: descMap[subslug] || doc.description || `Learn about ${doc.title}.`,
    path: sanitizeDocPath(`/docs/builder/${encodeURIComponent(subslug)}`),
    openGraphType: "article",
  });
}

export default async function BuilderSubDocPage({
  params,
}: {
  params: Promise<{ subslug: string }>;
}) {
  const { subslug } = await params;
  const slug = `builder/${subslug}`;
  const doc = getDoc(slug);

  if (!doc) {
    redirect("/docs/builder");
    return null;
  }

  const toc = extractToc(doc.body);
  const relatedDocs = getAllDocs()
    .filter((item) => item.slug !== slug)
    .filter((item) => item.category === "builder")
    .slice(0, 3);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Docs", path: "/docs" },
    { name: "Builder", path: "/docs/builder" },
    { name: doc.title, path: sanitizeDocPath(`/docs/builder/${encodeURIComponent(subslug)}`) },
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
            <h2 className="text-2xl font-semibold text-white">Related builder documentation</h2>
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
              <Link href="/templates" className="hover:text-white">
                Browse templates
              </Link>
              <Link href="/marketplace" className="hover:text-white">
                Explore marketplace workflows
              </Link>
            </div>
          </section>
        </article>

        <DocTOC items={toc} />
      </div>
    </>
  );
}

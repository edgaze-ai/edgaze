import { redirect } from "next/navigation";
import { Metadata } from "next";
import DocRenderer from "../components/DocRenderer";
import DocTOC from "../components/DocTOC";
import { CopyMarkdownButton } from "../components/CopyMarkdownButton";
import { getAllDocs, getDoc } from "../utils/docs";
import { extractToc } from "../utils/extractToc";

export function generateStaticParams() {
  return getAllDocs().map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDoc(slug);

  if (!doc) {
    return {
      title: "Documentation",
      description: "Edgaze documentation",
    };
  }

  return {
    title: `${doc.title} | Edgaze Documentation`,
    description: doc.description || `Learn about ${doc.title} in Edgaze`,
    openGraph: {
      title: `${doc.title} | Edgaze Documentation`,
      description: doc.description || `Learn about ${doc.title} in Edgaze`,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${doc.title} | Edgaze Documentation`,
      description: doc.description || `Learn about ${doc.title} in Edgaze`,
    },
  };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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

  return (
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
      </article>

      <DocTOC items={toc} />
    </div>
  );
}

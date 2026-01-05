import { redirect } from "next/navigation";
import DocRenderer from "../components/DocRenderer";
import { getAllDocs, getDoc } from "../utils/docs";

function extractToc(md: string) {
  // Only from "## " headings (good enough; matches changelog-month style)
  const lines = md.split("\n");
  const items: { id: string; text: string }[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      const text = line.slice(3).trim();
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
      items.push({ id, text });
    }
  }
  return items;
}

export function generateStaticParams() {
  return getAllDocs().map((d) => ({ slug: d.slug }));
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = getDoc(slug);

  if (!doc) redirect("/docs/changelog");

  const toc = extractToc(doc.body);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-10">
      {/* Main content */}
      <article className="min-w-0">
        <header className="pb-6 border-b border-white/10">
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-white/95">
            {doc.title}
          </h1>
          {doc.description ? (
            <p className="mt-3 text-sm sm:text-base text-white/55 leading-6 max-w-2xl">
              {doc.description}
            </p>
          ) : null}
        </header>

        <div className="pt-6">
          <DocRenderer content={doc.body} />
        </div>
      </article>

      {/* Right rail (desktop only) */}
      <aside className="hidden lg:block">
        {toc.length > 0 ? (
          <div className="sticky top-24">
            <div className="text-[11px] uppercase tracking-wider text-white/35">
              On this page
            </div>
            <div className="mt-3 border-l border-white/10 pl-4">
              <nav className="flex flex-col gap-2">
                {toc.map((t) => (
                  <a
                    key={t.id}
                    href={`#${t.id}`}
                    className="text-sm text-white/55 hover:text-white/85 transition"
                  >
                    {t.text}
                  </a>
                ))}
              </nav>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

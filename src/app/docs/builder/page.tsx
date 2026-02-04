import { redirect } from "next/navigation";
import { Metadata } from "next";
import DocRenderer from "../components/DocRenderer";
import DocTOC from "../components/DocTOC";
import { getDoc } from "../utils/docs";

function extractToc(md: string) {
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

export const metadata: Metadata = {
  title: "Builder Documentation | Edgaze",
  description: "Learn how to use Workflow Studio and Prompt Studio to create AI products. Complete guides for building workflows and prompts.",
  openGraph: {
    title: "Builder Documentation | Edgaze",
    description: "Learn how to use Workflow Studio and Prompt Studio to create AI products. Complete guides for building workflows and prompts.",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Builder Documentation | Edgaze",
    description: "Learn how to use Workflow Studio and Prompt Studio to create AI products. Complete guides for building workflows and prompts.",
  },
};

export default async function BuilderDocPage() {
  const doc = getDoc("builder");

  if (!doc) {
    redirect("/docs/changelog");
    return null;
  }

  const toc = extractToc(doc.body);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-10">
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

      <DocTOC items={toc} />
    </div>
  );
}

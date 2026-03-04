import { redirect } from "next/navigation";
import { Metadata } from "next";
import DocRenderer from "../components/DocRenderer";
import DocTOC from "../components/DocTOC";
import { CopyMarkdownButton } from "../components/CopyMarkdownButton";
import { getDoc } from "../utils/docs";

function extractToc(md: string) {
  const lines = md.split("\n");
  const items: { id: string; text: string }[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    let text: string | null = null;

    if (line.startsWith("## ")) {
      text = line.slice(3).trim();
    } else {
      const numbered = line.match(/^(\d+)\.\s+(.*)$/);
      if (numbered) {
        const part = numbered[2]?.trim() || null;
        const isListStep =
          !part ||
          /^\d/.test(part) ||
          part.includes(" - ") ||
          part.includes("**") ||
          part.length > 72 ||
          /^(Click|Type|Fill|Select|Look|Open|If you|You'll|Press|Enter|Add|Choose|Use|Switch|Drag|Release|Review|Save|Create|Edit|Delete|In the|When you|After |Before )/i.test(part);
        if (part && !isListStep) text = part;
      }
    }

    if (!text) continue;

    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");

    items.push({ id, text });
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
            <CopyMarkdownButton title={doc.title} />
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

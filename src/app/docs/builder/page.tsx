import { redirect } from "next/navigation";
import { Metadata } from "next";
import DocRenderer from "../components/DocRenderer";
import DocTOC from "../components/DocTOC";
import { CopyMarkdownButton } from "../components/CopyMarkdownButton";
import { getDoc } from "../utils/docs";
import { extractToc } from "../utils/extractToc";

export const metadata: Metadata = {
  title: "Builder Documentation",
  description:
    "Learn how to use Workflow Studio and Prompt Studio to create AI products. Complete guides for building workflows and prompts.",
  openGraph: {
    title: "Builder Documentation",
    description:
      "Learn how to use Workflow Studio and Prompt Studio to create AI products. Complete guides for building workflows and prompts.",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Builder Documentation",
    description:
      "Learn how to use Workflow Studio and Prompt Studio to create AI products. Complete guides for building workflows and prompts.",
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

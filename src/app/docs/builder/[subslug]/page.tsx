import { redirect } from "next/navigation";
import { Metadata } from "next";
import DocRenderer from "../../components/DocRenderer";
import DocTOC from "../../components/DocTOC";
import { CopyMarkdownButton } from "../../components/CopyMarkdownButton";
import { getDoc } from "../../utils/docs";
import { extractToc } from "../../utils/extractToc";

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
    return {
      title: "Builder Documentation",
      description: "Learn how to use Edgaze builders",
    };
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

  return {
    title: titleMap[subslug] || doc.title,
    description: descMap[subslug] || doc.description || `Learn about ${doc.title}`,
    openGraph: {
      title: titleMap[subslug] || doc.title,
      description: descMap[subslug] || doc.description || `Learn about ${doc.title}`,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: titleMap[subslug] || doc.title,
      description: descMap[subslug] || doc.description || `Learn about ${doc.title}`,
    },
  };
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

import { redirect } from "next/navigation";
import { Metadata } from "next";
import DocRenderer from "../../components/DocRenderer";
import DocTOC from "../../components/DocTOC";
import { getDoc } from "../../utils/docs";

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

export function generateStaticParams() {
  return [
    { subslug: "workflow-studio" },
    { subslug: "prompt-studio" },
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
      title: "Builder Documentation | Edgaze",
      description: "Learn how to use Edgaze builders",
    };
  }

  const titleMap: Record<string, string> = {
    "workflow-studio": "Workflow Studio Guide | Complete Tutorial for Building AI Workflows",
    "prompt-studio": "Prompt Studio Guide | Complete Tutorial for Creating AI Prompts",
  };

  const descMap: Record<string, string> = {
    "workflow-studio": "Complete guide to building AI workflows with Workflow Studio. Learn how to create complex multi-step AI processes, configure nodes, use the inspector panel, and publish workflows.",
    "prompt-studio": "Complete guide to creating reusable AI prompts with Prompt Studio. Learn how to use placeholders, configure prompts, test and publish your prompts.",
  };

  return {
    title: titleMap[subslug] || `${doc.title} | Edgaze Documentation`,
    description: descMap[subslug] || doc.description || `Learn about ${doc.title}`,
    openGraph: {
      title: titleMap[subslug] || `${doc.title} | Edgaze Documentation`,
      description: descMap[subslug] || doc.description || `Learn about ${doc.title}`,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: titleMap[subslug] || `${doc.title} | Edgaze Documentation`,
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

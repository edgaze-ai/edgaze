import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "../../lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Prompt Studio | Build Reusable AI Prompts on Edgaze",
  description:
    "Use Prompt Studio to create reusable AI prompts with placeholders, testing, versioning, and publishing workflows for creators and teams.",
  path: "/prompt-studio",
});

export default function PromptStudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <section className="sr-only">
        <h1>Create reusable AI prompts with inputs, versions, and publish-ready structure</h1>
        <p>
          Prompt Studio is the Edgaze workspace for turning raw prompt text into repeatable prompt
          products with placeholders, testing, versions, and publishing support.
        </p>
        <h2>Add reusable inputs</h2>
        <p>
          Placeholders make prompts configurable, easier to reuse, and easier to package as a
          product instead of a one-off block of text.
        </p>
        <h2>Version and test prompt logic</h2>
        <p>
          Prompt Studio gives creators a controlled way to iterate on wording, inputs, and output
          quality before publishing prompt products for real users.
        </p>
        <h2>Publish prompts with context</h2>
        <p>
          The studio connects directly to Edgaze publishing so prompts can be presented, discovered,
          and monetized with a clearer buyer-facing surface.
        </p>
        <nav aria-label="Prompt Studio resources">
          <Link href="/docs/builder/prompt-studio">Read Prompt Studio docs</Link>
          <Link href="/templates">Browse workflow templates</Link>
          <Link href="/why-workflows-not-prompts">See how prompts fit into Edgaze</Link>
          <Link href="/marketplace">Explore prompt products</Link>
        </nav>
      </section>
      {children}
    </>
  );
}

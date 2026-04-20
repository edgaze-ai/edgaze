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
        <h1>Prompt Studio for reusable AI prompts</h1>
        <p>
          Prompt Studio helps creators structure prompts, collect inputs, version prompt logic, and
          publish reusable AI prompt products people can run instantly on Edgaze.
        </p>
        <nav aria-label="Prompt Studio resources">
          <Link href="/templates">Browse workflow templates</Link>
          <Link href="/docs/builder/prompt-studio">Read Prompt Studio docs</Link>
          <Link href="/marketplace">Explore the marketplace</Link>
        </nav>
      </section>
      {children}
    </>
  );
}

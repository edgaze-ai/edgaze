// src/app/builder/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buildMetadata } from "../../lib/seo";
import BuilderClientPage from "./BuilderClientPage";

export const metadata: Metadata = buildMetadata({
  title: "AI Workflow Builder | Edgaze Workflow Studio",
  description:
    "Use Edgaze Workflow Studio to build, test, and publish AI workflows with prompts, logic, tools, and reusable execution paths.",
  path: "/builder",
});

export default function BuilderPage() {
  return (
    <>
      <section className="sr-only">
        <h1>AI Workflow Builder for creator run automation</h1>
        <p>
          Workflow Studio is where creators design multistep AI workflows, connect prompts and
          tools, test outputs, and publish workflow products people can run instantly on Edgaze.
        </p>
        <nav aria-label="Workflow Studio resources">
          <Link href="/templates">Start from a template</Link>
          <Link href="/docs/builder/workflow-studio">Read Workflow Studio docs</Link>
          <Link href="/marketplace">Explore marketplace listings</Link>
          <Link href="/creators">Learn about the creator program</Link>
        </nav>
      </section>
      <Suspense fallback={<div className="p-6 text-white/70 text-sm">Loading builder…</div>}>
        <BuilderClientPage />
      </Suspense>
    </>
  );
}

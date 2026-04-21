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
        <h1>Build AI workflows that are ready to test, publish, and sell</h1>
        <p>
          The Edgaze builder is where creators turn prompts, tools, branching logic, and structured
          outputs into runnable workflow products before those workflows go live in the marketplace.
        </p>
        <h2>Build with real workflow logic</h2>
        <p>
          Connect prompts, inputs, tools, and outputs in one visual canvas so the workflow behaves
          like a system, not a single text fragment.
        </p>
        <h2>Test before you publish</h2>
        <p>
          Use builder runs to validate structure, inspect outputs, and refine the workflow before it
          becomes a public product page or marketplace listing.
        </p>
        <h2>Ship from the same surface</h2>
        <p>
          Workflow Studio ties directly into templates, public pages, and marketplace distribution
          so creators can move from draft logic to a monetizable product.
        </p>
        <nav aria-label="Workflow Studio resources">
          <Link href="/docs/builder/workflow-studio">Read Workflow Studio docs</Link>
          <Link href="/templates">Start from templates</Link>
          <Link href="/workflow-studio">See the Workflow Studio guide</Link>
          <Link href="/marketplace">Explore published workflows</Link>
        </nav>
      </section>
      <Suspense fallback={<div className="p-6 text-white/70 text-sm">Loading builder…</div>}>
        <BuilderClientPage />
      </Suspense>
    </>
  );
}

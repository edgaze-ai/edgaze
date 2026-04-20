"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { templateService, type TemplateDefinition } from "../../lib/templates";
import TemplateGraphPreview from "./TemplateGraphPreview";
import TemplateSetupModal from "./TemplateSetupModal";

async function createDraftFromTemplate(
  template: TemplateDefinition,
  answers: Record<string, unknown>,
  getAccessToken: (() => Promise<string | null>) | undefined,
) {
  const instantiated = await templateService.instantiate({
    template,
    answers,
    context: { mode: "template_page" },
  });
  const token = await getAccessToken?.();
  const response = await fetch("/api/creator/workflow-drafts", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      title: instantiated.workflowName,
      graph: instantiated.graph,
    }),
  });

  if (!response.ok) throw new Error((await response.text()) || "Failed to create workflow.");
  const json = await response.json();
  return String(json?.draft?.id ?? "");
}

function titleCase(input: string) {
  return input
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function TemplateDetailPageClient({
  template,
  relatedTemplates,
}: {
  template: TemplateDefinition;
  relatedTemplates: TemplateDefinition[];
}) {
  const router = useRouter();
  const { requireAuth, getAccessToken } = useAuth();
  const [setupOpen, setSetupOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const originalHtmlHeight = html.style.height;
    const originalHtmlOverflowY = html.style.overflowY;
    const originalBodyHeight = body.style.height;
    const originalBodyOverflowY = body.style.overflowY;

    const applyScrolling = () => {
      const isMobile = window.matchMedia("(max-width: 1023px)").matches;
      if (isMobile) {
        html.classList.add("library-mobile-scroll");
        body.classList.add("library-mobile-scroll");
        html.style.height = "auto";
        html.style.minHeight = "100%";
        html.style.overflowY = "auto";
        body.style.height = "auto";
        body.style.minHeight = "100%";
        body.style.overflowY = "auto";
      } else {
        html.classList.remove("library-mobile-scroll");
        body.classList.remove("library-mobile-scroll");
        html.style.height = "100%";
        html.style.overflowY = "hidden";
        body.style.height = "100%";
        body.style.overflowY = "hidden";
      }
      html.style.overflowX = "hidden";
      body.style.overflowX = "hidden";
    };

    applyScrolling();
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const onChange = () => applyScrolling();
    mediaQuery.addEventListener?.("change", onChange);
    window.addEventListener("resize", onChange);

    return () => {
      mediaQuery.removeEventListener?.("change", onChange);
      window.removeEventListener("resize", onChange);
      html.classList.remove("library-mobile-scroll");
      body.classList.remove("library-mobile-scroll");
      html.style.height = originalHtmlHeight;
      html.style.overflowY = originalHtmlOverflowY;
      body.style.height = originalBodyHeight;
      body.style.overflowY = originalBodyOverflowY;
    };
  }, []);

  const launchTemplate = async (answers: Record<string, unknown> = {}) => {
    if (!requireAuth()) return;
    setSubmitting(true);
    setErrorText(null);
    try {
      const draftId = await createDraftFromTemplate(template, answers, getAccessToken);
      router.push(
        `/builder?draftId=${encodeURIComponent(draftId)}&templateSlug=${encodeURIComponent(template.slug)}`,
      );
    } catch (error: any) {
      setErrorText(error?.message || "Failed to create workflow from template.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrimary = () => {
    if (!requireAuth()) return;
    if (template.setup.mode === "none") {
      void launchTemplate();
      return;
    }
    setSetupOpen(true);
  };

  return (
    <div
      data-library-page
      className="min-h-screen w-full overflow-y-auto overflow-x-hidden bg-[#050505] pb-16 text-white"
    >
      <div className="mx-auto max-w-[1320px] px-4 pt-8 sm:px-6 lg:px-8">
        <section>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/58">
              {template.meta.category}
            </span>
            <span className="rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/48">
              {template.meta.difficulty ?? "beginner"}
            </span>
          </div>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">
            {template.meta.name}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-white/56 sm:text-lg">
            {template.meta.longDescription}
          </p>

          <div className="mt-6">
            <button
              type="button"
              onClick={handlePrimary}
              className="inline-flex items-center gap-2 rounded-[12px] border border-white/12 bg-[#d8d8d4] px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#cfcfca]"
            >
              Use template
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        <section className="relative mt-10 overflow-hidden rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,10,10,0.995),rgba(6,6,6,1))] p-5 shadow-[0_24px_72px_rgba(0,0,0,0.42)] sm:rounded-[22px] sm:p-6">
          <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_top_left,rgba(65,212,255,0.06),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(255,84,160,0.04),transparent_20%)]" />
          <TemplateGraphPreview graph={template.preview.graphLayout} />
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-3">
          <div className="rounded-[16px] border border-white/10 bg-[#0c0c0c] p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/34">
              What it does
            </div>
            <p className="mt-3 text-[15px] leading-7 text-white/54">
              {template.meta.shortDescription}
            </p>
          </div>

          <div className="rounded-[16px] border border-white/10 bg-[#0c0c0c] p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/34">
              Setup
            </div>
            <div className="mt-3 space-y-2 text-[15px] leading-7 text-white/54">
              {(template.setup.fields.length
                ? template.setup.fields
                : [{ id: "none", label: "No setup required" }]
              ).map((field) => (
                <div key={field.id}>{field.label}</div>
              ))}
            </div>
          </div>

          <div className="rounded-[16px] border border-white/10 bg-[#0c0c0c] p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/34">
              Tags
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {template.meta.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-[10px] border border-white/10 bg-[#101010] px-2.5 py-1 text-[11px] text-white/50"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[16px] border border-white/10 bg-[#0c0c0c] p-6">
            <h2 className="text-lg font-semibold text-white">Who this template is for</h2>
            <p className="mt-3 text-[15px] leading-7 text-white/54">
              This template is designed for creators who want a {titleCase(template.meta.category)}{" "}
              workflow they can adapt quickly without building every node from scratch. It works
              well for {template.meta.difficulty ?? "beginner"} creators who want a structured
              starting point and enough flexibility to keep editing inside Workflow Studio.
            </p>
          </div>

          <div className="rounded-[16px] border border-white/10 bg-[#0c0c0c] p-6">
            <h2 className="text-lg font-semibold text-white">How to use it</h2>
            <ol className="mt-3 space-y-2 text-[15px] leading-7 text-white/54">
              <li>
                Review the graph preview and setup fields to understand the workflow structure.
              </li>
              <li>Use the template to create an editable workflow draft in Builder.</li>
              <li>
                Customize prompts, tools, inputs, and publishing details for your own use case.
              </li>
              <li>Publish the final workflow with a clear public page when it is ready.</li>
            </ol>
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[16px] border border-white/10 bg-[#0c0c0c] p-6">
            <h2 className="text-lg font-semibold text-white">Example use cases</h2>
            <ul className="mt-3 space-y-2 text-[15px] leading-7 text-white/54">
              {(template.meta.outcomes?.length ? template.meta.outcomes : template.meta.tags).map(
                (item) => (
                  <li key={item}>
                    Use this template to launch a {item.toLowerCase()} workflow with a clearer
                    starting structure and faster path to publishing.
                  </li>
                ),
              )}
            </ul>
          </div>

          <div className="rounded-[16px] border border-white/10 bg-[#0c0c0c] p-6">
            <h2 className="text-lg font-semibold text-white">Why this template exists</h2>
            <p className="mt-3 text-[15px] leading-7 text-white/54">
              Templates on Edgaze help creators move from idea to runnable workflow product faster.
              Instead of reconstructing a graph manually, you start from a proven structure and
              adapt the workflow to your audience, niche, and publishing goals.
            </p>
          </div>
        </section>

        <section className="mt-10 rounded-[16px] border border-white/10 bg-[#0c0c0c] p-6">
          <h2 className="text-lg font-semibold text-white">Related Edgaze resources</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/56">
            Use this template as a starting point, then refine the workflow in Builder, review the
            matching docs, explore live marketplace listings, and learn how creators publish useful
            workflow products.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-white/75">
            <a href="/builder" className="hover:text-white">
              Open Workflow Builder
            </a>
            <a href="/docs/builder/templates" className="hover:text-white">
              Read template docs
            </a>
            <a href="/marketplace" className="hover:text-white">
              Explore marketplace workflows
            </a>
            <a href="/creators" className="hover:text-white">
              Visit the creator program
            </a>
          </div>
        </section>

        {relatedTemplates.length > 0 ? (
          <section className="mt-10 rounded-[16px] border border-white/10 bg-[#0c0c0c] p-6">
            <h2 className="text-lg font-semibold text-white">Related templates</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {relatedTemplates.map((item) => (
                <Link
                  key={item.slug}
                  href={`/templates/${item.slug}`}
                  className="rounded-[14px] border border-white/10 bg-[#101010] p-4 transition-colors hover:bg-white/[0.05]"
                >
                  <div className="text-sm font-semibold text-white">{item.meta.name}</div>
                  <p className="mt-2 text-sm leading-6 text-white/54">
                    {item.meta.shortDescription}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <TemplateSetupModal
        open={setupOpen}
        template={template}
        submitting={submitting}
        errorText={errorText}
        onClose={() => {
          if (!submitting) {
            setSetupOpen(false);
            setErrorText(null);
          }
        }}
        onSubmit={(answers) => void launchTemplate(answers)}
      />
    </div>
  );
}

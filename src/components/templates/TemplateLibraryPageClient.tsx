"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Image as ImageIcon, Search, Sparkles, Wrench } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import {
  templateService,
  type TemplateCategory,
  type TemplateDefinition,
} from "../../lib/templates";
import TemplateCard from "./TemplateCard";
import TemplateSetupModal from "./TemplateSetupModal";

const CATEGORIES: Array<{ id: TemplateCategory | "all"; label: string; copy: string }> = [
  { id: "all", label: "All templates", copy: "Browse the full library." },
  {
    id: "image",
    label: "Image generation",
    copy: "Visual workflows with prompt shaping and render output.",
  },
  {
    id: "social",
    label: "Social content",
    copy: "Use templates built around hooks, drafts, and publication-ready copy.",
  },
  {
    id: "utility",
    label: "Utility",
    copy: "Structured helper workflows for parsing, formatting, and ops.",
  },
];

function CategoryGlyph({ category }: { category: TemplateCategory | "all" }) {
  if (category === "image") return <ImageIcon className="h-3.5 w-3.5" />;
  if (category === "all") return <Sparkles className="h-3.5 w-3.5" />;
  return <Wrench className="h-3.5 w-3.5" />;
}

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

  if (!response.ok) {
    throw new Error((await response.text()) || "Failed to create template workflow.");
  }

  const json = await response.json();
  return String(json?.draft?.id ?? "");
}

export default function TemplateLibraryPageClient({
  templates,
}: {
  templates: TemplateDefinition[];
}) {
  const router = useRouter();
  const { requireAuth, getAccessToken } = useAuth();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<TemplateCategory | "all">("all");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDefinition | null>(null);
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

  const featuredTemplates = templates.filter((template) => template.meta.featured);

  const filteredTemplates = useMemo(
    () =>
      templates.filter((template) => {
        if (category !== "all" && template.meta.category !== category) return false;
        if (!query.trim()) return true;
        const haystack = [
          template.meta.name,
          template.meta.shortDescription,
          template.meta.longDescription,
          ...template.meta.tags,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query.trim().toLowerCase());
      }),
    [templates, category, query],
  );

  const handleStart = async (
    template: TemplateDefinition,
    answers: Record<string, unknown> = {},
  ) => {
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

  const openTemplate = (template: TemplateDefinition) => {
    if (!requireAuth()) return;
    if (template.setup.mode === "none") {
      void handleStart(template);
      return;
    }
    setSelectedTemplate(template);
    setErrorText(null);
  };

  return (
    <div
      data-library-page
      className="min-h-screen w-full overflow-y-auto overflow-x-hidden bg-[#050505] text-white [scrollbar-gutter:stable]"
    >
      <div className="mx-auto max-w-[1320px] px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(9,9,10,0.995),rgba(5,5,5,1))] px-6 py-10 shadow-[0_24px_80px_rgba(0,0,0,0.46)] sm:px-8 sm:py-12 lg:px-10">
          <div className="pointer-events-none absolute inset-x-16 top-0 h-px bg-white/12 opacity-90" />
          <div className="max-w-4xl">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/34">
                Template library
              </div>
              <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">
                Start with proven workflow structures, not raw nodes.
              </h1>
              <p className="mt-5 max-w-2xl text-[15px] leading-7 text-white/56 sm:text-base">
                Discover outcome-first templates, preview the exact graph shape, answer a few setup
                questions, and open an editable workflow in the builder without digging through
                low-level node plumbing first.
              </p>
              <div className="relative mt-7 max-w-xl">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by outcome, category, or tag"
                  className="w-full rounded-full border border-white/[0.08] bg-black/25 py-4 pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-white/28 focus:border-white/[0.14]"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/34">
                Featured templates
              </div>
            </div>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            {featuredTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} onPrimaryAction={openTemplate} />
            ))}
          </div>
        </section>

        <section className="mt-12">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((option) => {
              const active = category === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setCategory(option.id)}
                  className={[
                    "inline-flex items-center gap-2 rounded-[12px] border px-4 py-2.5 text-sm transition-colors",
                    active
                      ? "border-white/[0.14] bg-white/[0.07] text-white"
                      : "border-white/[0.08] bg-[#101010] text-white/56 hover:bg-white/[0.04]",
                  ].join(" ")}
                >
                  <CategoryGlyph category={option.id} />
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="mt-8 grid gap-5 xl:grid-cols-2">
            {filteredTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} onPrimaryAction={openTemplate} />
            ))}
          </div>

          {!filteredTemplates.length ? (
            <div className="mt-8 rounded-[24px] border border-dashed border-white/12 bg-white/[0.03] px-6 py-10 text-sm text-white/55">
              No templates found.
            </div>
          ) : null}
        </section>

        <section className="mt-14 rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(10,10,10,0.995),rgba(6,6,6,1))] px-6 py-8 shadow-[0_24px_72px_rgba(0,0,0,0.4)] sm:px-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/34">
                Builder handoff
              </div>
            </div>
            <button
              type="button"
              onClick={() => featuredTemplates[0] && openTemplate(featuredTemplates[0])}
              className="inline-flex items-center justify-center gap-2 rounded-[12px] border border-white/[0.08] bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/92"
            >
              Use a template
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        <section className="mt-10 rounded-[20px] border border-white/[0.08] bg-white/[0.03] px-6 py-6">
          <h2 className="text-xl font-semibold text-white">Keep moving from template to launch</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
            Templates work best when paired with the public builder guides, marketplace examples,
            and creator resources that explain how workflows get published and monetized on Edgaze.
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-white/75">
            <a href="/builder" className="hover:text-white">
              Open Workflow Builder
            </a>
            <a href="/docs/builder/templates" className="hover:text-white">
              Read template documentation
            </a>
            <a href="/marketplace" className="hover:text-white">
              Browse marketplace examples
            </a>
            <a href="/creators" className="hover:text-white">
              Learn about creator publishing
            </a>
          </div>
        </section>
      </div>

      <TemplateSetupModal
        open={Boolean(selectedTemplate)}
        template={selectedTemplate}
        submitting={submitting}
        errorText={errorText}
        onClose={() => {
          if (!submitting) {
            setSelectedTemplate(null);
            setErrorText(null);
          }
        }}
        onSubmit={(answers) => {
          if (!selectedTemplate) return;
          void handleStart(selectedTemplate, answers);
        }}
      />
    </div>
  );
}

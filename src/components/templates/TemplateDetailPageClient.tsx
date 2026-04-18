"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { templateService, type TemplateDefinition } from "@/lib/templates";
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

export default function TemplateDetailPageClient({ template }: { template: TemplateDefinition }) {
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

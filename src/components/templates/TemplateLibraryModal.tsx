"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Image as ImageIcon,
  Search,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import type { TemplateCategory, TemplateDefinition } from "@/lib/templates";
import TemplateCard from "./TemplateCard";
import TemplateGraphPreview from "./TemplateGraphPreview";

const CATEGORY_OPTIONS: Array<{ id: TemplateCategory | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "image", label: "Image" },
  { id: "social", label: "Social" },
  { id: "utility", label: "Utility" },
  { id: "research", label: "Research" },
];

function CategoryGlyph({ category }: { category: TemplateCategory | "all" }) {
  if (category === "image") return <ImageIcon className="h-3.5 w-3.5" />;
  if (category === "all") return <Sparkles className="h-3.5 w-3.5" />;
  return <Wrench className="h-3.5 w-3.5" />;
}

export default function TemplateLibraryModal({
  open,
  templates,
  busy = false,
  onClose,
  onUseTemplate,
}: {
  open: boolean;
  templates: TemplateDefinition[];
  busy?: boolean;
  onClose: () => void;
  onUseTemplate: (template: TemplateDefinition) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<TemplateCategory | "all">("all");
  const [detailTemplateId, setDetailTemplateId] = useState<string | null>(null);

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

  const detailTemplate = templates.find((template) => template.id === detailTemplateId) ?? null;

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 left-0 z-[110] flex items-center justify-center bg-black/78 p-4 backdrop-blur-xl md:left-[52px]">
      <div className="relative flex h-[min(680px,calc(100vh-24px))] w-[min(1100px,calc(100vw-24px))] overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,10,11,0.995),rgba(5,5,5,1))] shadow-[0_40px_160px_rgba(0,0,0,0.82)] sm:h-[min(700px,calc(100vh-40px))] sm:w-[min(1120px,calc(100vw-40px))] sm:rounded-[24px]">
        <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_top_left,rgba(65,212,255,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(255,84,160,0.05),transparent_24%)]" />
        <div className="grid min-h-0 w-full lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-y-auto border-b border-white/10 bg-[#090909] p-5 lg:border-b-0 lg:border-r">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="max-w-[11ch] text-[2rem] font-semibold leading-none tracking-[-0.04em] text-white">
                  Templates
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid h-11 w-11 place-items-center rounded-[12px] border border-white/10 bg-[#101010] text-white/62 transition-colors hover:bg-[#151515]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative mt-5">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search templates"
                className="w-full rounded-[14px] border border-white/10 bg-[#101010] py-3 pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-white/28 focus:border-white/15"
              />
            </div>

            <div className="mt-5 space-y-2">
              {CATEGORY_OPTIONS.map((option) => {
                const active = option.id === category;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setCategory(option.id)}
                    className={[
                      "flex w-full items-center justify-between rounded-[14px] border px-4 py-3 text-left text-sm transition-colors",
                      active
                        ? "border-white/12 bg-[linear-gradient(180deg,rgba(20,20,20,1),rgba(14,14,14,1))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                        : "border-white/10 bg-[#101010] text-white/55 hover:bg-[#141414]",
                    ].join(" ")}
                  >
                    <span className="inline-flex items-center gap-2">
                      <CategoryGlyph category={option.id} />
                      {option.label}
                    </span>
                    <span className="text-xs uppercase tracking-[0.16em] text-white/35">
                      {option.id === "all"
                        ? templates.length
                        : templates.filter((template) => template.meta.category === option.id)
                            .length}
                    </span>
                  </button>
                );
              })}
            </div>

            <Link
              href="/templates"
              className="mt-6 inline-flex rounded-[12px] border border-white/10 bg-[#101010] px-4 py-2.5 text-sm font-medium text-white/72 transition-colors hover:bg-[#151515]"
            >
              Open full library
            </Link>
          </aside>

          <main className="library-scroll min-h-0 overflow-y-auto bg-[#070707] p-5 sm:p-6">
            {detailTemplate ? (
              <div>
                <button
                  type="button"
                  onClick={() => setDetailTemplateId(null)}
                  className="inline-flex items-center gap-2 rounded-[12px] border border-white/10 bg-[#101010] px-4 py-2.5 text-sm font-medium text-white/72 transition-colors hover:bg-[#151515]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {detailTemplate.meta.featured ? (
                    <span className="inline-flex items-center gap-1 rounded-[10px] border border-white/10 bg-[linear-gradient(90deg,rgba(65,212,255,0.08),rgba(255,84,160,0.05))] px-2.5 py-1 text-[10px] font-medium text-white/78">
                      <Sparkles className="h-3 w-3" />
                      Featured
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1 rounded-[10px] border border-white/10 bg-[#101010] px-2.5 py-1 text-[10px] font-medium text-white/58">
                    <CategoryGlyph category={detailTemplate.meta.category} />
                    {detailTemplate.meta.category}
                  </span>
                </div>

                <h3 className="mt-5 max-w-3xl text-[2.1rem] font-semibold leading-none tracking-[-0.05em] text-white">
                  {detailTemplate.meta.name}
                </h3>

                <div className="mt-4">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onUseTemplate(detailTemplate)}
                    className="inline-flex min-w-0 items-center justify-center gap-2 rounded-[12px] border border-white/12 bg-[#d8d8d4] px-4 py-2.5 text-[13px] font-semibold text-black transition-colors hover:bg-[#cfcfca] disabled:opacity-70"
                  >
                    {detailTemplate.setup.mode === "none" ? "Use template" : "Configure template"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <TemplateGraphPreview
                  graph={detailTemplate.preview.graphLayout}
                  className="mt-6 h-[300px]"
                />

                <div className="mt-6 grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[16px] border border-white/10 bg-[#101010] p-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/34">
                      Setup
                    </div>
                    <div className="mt-3 space-y-2 text-[14px] leading-6 text-white/58">
                      {(detailTemplate.setup.fields.length
                        ? detailTemplate.setup.fields
                        : [{ id: "none", label: "No setup required" }]
                      ).map((field) => (
                        <div key={field.id}>
                          <span className="font-medium text-white/82">{field.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[16px] border border-white/10 bg-[#101010] p-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/34">
                      Tags
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {detailTemplate.meta.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-[10px] border border-white/10 bg-[#0d0d0d] px-2.5 py-1 text-[11px] text-white/50"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/34">
                    Templates
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {filteredTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      primaryLabel="Add to builder"
                      onPrimaryAction={onUseTemplate}
                      onViewDetails={(value) => setDetailTemplateId(value.id)}
                      dense
                    />
                  ))}
                </div>

                {!filteredTemplates.length ? (
                  <div className="mt-8 rounded-[24px] border border-dashed border-white/12 bg-[#0d0d0d] px-6 py-10 text-sm text-white/55">
                    No templates found.
                  </div>
                ) : null}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { ArrowRight, Image as ImageIcon, Sparkles, Wrench } from "lucide-react";
import type { TemplateDefinition } from "@/lib/templates";
import TemplateGraphPreview from "./TemplateGraphPreview";

function CategoryIcon({ category }: { category: TemplateDefinition["meta"]["category"] }) {
  if (category === "image") return <ImageIcon className="h-3.5 w-3.5" />;
  return <Wrench className="h-3.5 w-3.5" />;
}

function TemplateCard({
  template,
  primaryLabel = "Use template",
  onPrimaryAction,
  onViewDetails,
  dense = false,
}: {
  template: TemplateDefinition;
  primaryLabel?: string;
  onPrimaryAction?: (template: TemplateDefinition) => void;
  onViewDetails?: (template: TemplateDefinition) => void;
  dense?: boolean;
}) {
  return (
    <article className="group relative flex h-[332px] flex-col overflow-hidden rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,16,17,1),rgba(9,9,10,1))] shadow-[0_16px_40px_rgba(0,0,0,0.34)] transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-[1px] hover:border-white/12 hover:shadow-[0_22px_48px_rgba(0,0,0,0.42)]">
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_top_left,rgba(65,212,255,0.06),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(255,84,160,0.04),transparent_24%)]" />
      <div className="relative flex h-full flex-col p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {template.meta.featured && (
                <span className="inline-flex items-center gap-1 rounded-[10px] border border-white/10 bg-[linear-gradient(90deg,rgba(65,212,255,0.08),rgba(255,84,160,0.05))] px-2 py-1 text-[10px] font-medium text-white/78">
                  <Sparkles className="h-3 w-3" />
                  Featured
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-[10px] border border-white/10 bg-[#101010] px-2 py-1 text-[10px] font-medium text-white/58">
                <CategoryIcon category={template.meta.category} />
                {template.meta.category}
              </span>
            </div>
            <h3 className="max-w-full text-[1.05rem] font-semibold leading-[1.2] tracking-[-0.03em] text-white">
              {template.meta.name}
            </h3>
          </div>
          <div className="rounded-[12px] border border-white/10 bg-[#101010] px-2.5 py-2 text-right">
            <div className="text-[11px] font-medium text-white/78">
              {template.setup.mode === "none"
                ? "Instant"
                : `${template.meta.estimatedSetupMinutes ?? 2} min`}
            </div>
          </div>
        </div>

        <div className="mt-1 flex-1">
          <TemplateGraphPreview
            graph={template.preview.graphLayout}
            compact={dense}
            className="h-full"
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {onViewDetails ? (
            <button
              type="button"
              onClick={() => onViewDetails(template)}
              className="inline-flex min-w-0 items-center justify-center gap-2 rounded-[12px] border border-white/10 bg-[#101010] px-3 py-2.5 text-[13px] font-medium text-white/78 transition-colors hover:bg-[#151515]"
            >
              View
            </button>
          ) : (
            <Link
              href={`/templates/${template.slug}`}
              className="inline-flex min-w-0 items-center justify-center gap-2 rounded-[12px] border border-white/10 bg-[#101010] px-3 py-2.5 text-[13px] font-medium text-white/78 transition-colors hover:bg-[#151515]"
            >
              View
            </Link>
          )}
          <button
            type="button"
            onClick={() => onPrimaryAction?.(template)}
            className="inline-flex min-w-0 items-center justify-center gap-2 rounded-[12px] border border-white/12 bg-[#d8d8d4] px-3 py-2.5 text-[13px] font-semibold text-black transition-colors hover:bg-[#cfcfca]"
          >
            {primaryLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}

export default TemplateCard;

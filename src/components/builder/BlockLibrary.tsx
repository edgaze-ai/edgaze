"use client";

import { useMemo, useState, useEffect, useRef, memo, type ReactElement } from "react";
import { listNodeSpecs } from "src/nodes/registry";
import { matchNodesFromNaturalLanguage } from "src/nodes/nodeSearch";
import type { NodeSpec } from "src/nodes/types";
import {
  IconClose,
  IconConditions,
  IconCore,
  IconIntegrations,
  IconLLM,
  IconLoops,
  IconPlus,
  IconSearch,
  IconSpark,
} from "./icons/EdgazeIcons";

import { NodePreviewCard } from "./NodePreviewCard";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type LibraryCategoryId = "core" | "llm" | "integrations" | "conditions" | "loops" | "all";
type LibraryCategory = {
  id: LibraryCategoryId;
  label: string;
  icon: (p: { active?: boolean }) => ReactElement;
};

const CATEGORIES: LibraryCategory[] = [
  {
    id: "all",
    label: "All",
    icon: ({ active }) => <IconCore size={18} tone={active ? "brand" : "muted"} />,
  },
  {
    id: "core",
    label: "Core",
    icon: ({ active }) => <IconCore size={18} tone={active ? "brand" : "muted"} />,
  },
  {
    id: "llm",
    label: "LLM",
    icon: ({ active }) => <IconLLM size={18} tone={active ? "brand" : "muted"} />,
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: ({ active }) => <IconIntegrations size={18} tone={active ? "brand" : "muted"} />,
  },
  {
    id: "conditions",
    label: "Conditions",
    icon: ({ active }) => <IconConditions size={18} tone={active ? "brand" : "muted"} />,
  },
  {
    id: "loops",
    label: "Loops",
    icon: ({ active }) => <IconLoops size={18} tone={active ? "brand" : "muted"} />,
  },
];

function normalizeCategory(spec: NodeSpec): Exclude<LibraryCategoryId, "all"> {
  const raw = String((spec as any)?.category ?? "").toLowerCase();
  const id = spec.id.toLowerCase();
  if (id.includes("loop") || raw.includes("loop")) return "loops";
  if (id.includes("condition") || raw.includes("condition")) return "conditions";
  if (
    raw.includes("integration") ||
    raw.includes("http") ||
    id.includes("http") ||
    id.includes("webhook") ||
    id.includes("request")
  )
    return "integrations";
  if (id.includes("llm") || id.includes("openai") || id.includes("gemini") || raw.includes("llm"))
    return "llm";
  return "core";
}

function EdgazeTooltip({
  open,
  text,
  anchorClassName = "",
}: {
  open: boolean;
  text: string;
  anchorClassName?: string;
}) {
  return (
    <div className={cx("relative", anchorClassName)}>
      <div
        className={cx(
          "pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2",
          "transition-[opacity,transform] duration-200",
          open ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-1",
        )}
      >
        <div className="relative rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-[11px] font-medium text-white/82 shadow-[0_16px_60px_rgba(0,0,0,0.65)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-[var(--edgaze-inner-highlight)] opacity-50" />
          {text}
        </div>
      </div>
    </div>
  );
}

/* ---------- Quick-start pill ---------- */
function QuickStartItem({
  icon,
  title,
  caption,
  templateId,
  onLoad,
}: {
  icon: React.ReactNode;
  title: string;
  caption: string;
  templateId: string;
  onLoad: (templateId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onLoad(templateId)}
      className={cx(
        "group relative flex w-full items-center gap-3 overflow-hidden text-left",
        "rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))]",
        "shadow-[0_18px_70px_rgba(0,0,0,0.42)]",
        "transition-[transform,background,border-color] duration-200",
        "hover:-translate-y-[1px] hover:border-white/14 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.024))]",
      )}
    >
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-[var(--edgaze-inner-highlight)] opacity-40" />
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/25">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <div className="font-semibold text-[12px] tracking-[-0.01em] text-white/92">{title}</div>
          <span className="opacity-55 shrink-0 text-[10px] tracking-[0.14em] uppercase text-white/45">
            Open
          </span>
        </div>
        <div className="truncate text-[11px] text-white/60">{caption}</div>
      </div>
    </button>
  );
}

/* ---------- Block library ---------- */
function BlockLibrary({
  onAdd,
  onLoadQuickStart,
}: {
  onAdd?: (specId: string) => void;
  onLoadQuickStart?: (templateId: string) => void;
}) {
  const [q, setQ] = useState("");
  const [showQS, setShowQS] = useState(true);
  const [activeCategory, setActiveCategory] = useState<LibraryCategoryId>("all");
  const [hoveredCategory, setHoveredCategory] = useState<LibraryCategoryId | null>(null);
  const [aiSearchOpen, setAiSearchOpen] = useState(false);
  const [aiSearchQuery, setAiSearchQuery] = useState("");
  const [aiSearchResult, setAiSearchResult] = useState<{
    suggestions: NodeSpec[];
    message: string;
  } | null>(null);
  const aiSearchInputRef = useRef<HTMLInputElement>(null);

  const all = listNodeSpecs();
  const items = useMemo(() => {
    const filteredByCategory =
      activeCategory === "all"
        ? all
        : all.filter((s) => normalizeCategory(s) === (activeCategory as any));
    if (!q) return filteredByCategory;
    const term = q.toLowerCase();
    return filteredByCategory.filter((s) =>
      `${s.label} ${s.id} ${s.summary}`.toLowerCase().includes(term),
    );
  }, [q, all, activeCategory]);

  const handleAdd = (specId: string) => {
    // keep existing behaviour – do NOT change event name
    window.dispatchEvent(
      new CustomEvent("edgaze:add-node", { detail: { specId, source: "library" } }),
    );
    onAdd?.(specId);
  };

  const runAiSearch = () => {
    const { suggestions, message } = matchNodesFromNaturalLanguage(aiSearchQuery, all);
    setAiSearchResult({ suggestions, message });
  };

  useEffect(() => {
    if (!aiSearchOpen) return;
    queueMicrotask(() => {
      setAiSearchResult(null);
      setAiSearchQuery("");
    });
    const t = setTimeout(() => aiSearchInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [aiSearchOpen]);

  return (
    <div className="relative flex h-full flex-col">
      {/* Search + AI button */}
      <div className="px-3 pt-3">
        <div className="relative">
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/55">
            <IconSearch size={18} />
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search blocks..."
            className={cx(
              "w-full rounded-2xl border border-white/10 bg-black/25 py-2.5 pl-10 pr-10 text-[12px] text-white/92 placeholder:text-white/35",
              "outline-none transition-[border-color,background] duration-200 focus:border-white/18 focus:bg-black/30",
            )}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 edg-builder-btn h-8 w-8 rounded-full grid place-items-center"
              title="Clear search"
            >
              <IconClose size={16} className="text-white/70" />
            </button>
          )}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <button
            className="edgaze-flow w-full rounded-[16px] p-[1.2px]"
            title="Search nodes with AI"
            type="button"
            onClick={() => setAiSearchOpen(true)}
          >
            <div className="relative flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#0f0f10] px-3 py-2.5 text-[12px] font-medium text-white/90">
              <IconSpark size={18} tone="brand" />
              <span>Search nodes with AI</span>
            </div>
          </button>
        </div>
      </div>

      {/* AI Search modal (no LLM: natural-language match to nodes) */}
      {aiSearchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 py-6 safe-area-padding"
          onClick={() => setAiSearchOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Search nodes with AI"
        >
          <div
            className="ai-modal-glow my-auto w-full max-w-md flex-shrink-0 rounded-2xl p-[1.5px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex max-h-[min(85vh,28rem)] flex-col rounded-2xl bg-[#07080b] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 flex-shrink-0">
                <span className="flex items-center gap-2 text-[14px] font-semibold">
                  <IconSpark size={18} tone="brand" />
                  Search nodes with AI
                </span>
                <button
                  type="button"
                  onClick={() => setAiSearchOpen(false)}
                  className="edg-builder-btn h-9 w-9 rounded-full grid place-items-center"
                  aria-label="Close"
                >
                  <IconClose size={18} className="text-white/70" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
                <p className="text-[12px] text-white/70">
                  Describe what you want in plain English (e.g. &quot;generate an image&quot;,
                  &quot;call an API&quot;, &quot;merge data&quot;). I&apos;ll suggest matching
                  nodes—no AI API used.
                </p>
                <div className="space-y-3">
                  <div className="ai-input-glow w-full rounded-xl p-[1.5px]">
                    <input
                      ref={aiSearchInputRef}
                      type="text"
                      value={aiSearchQuery}
                      onChange={(e) => setAiSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") runAiSearch();
                      }}
                      placeholder="e.g. send email, HTTP request, condition..."
                      className="w-full rounded-[10px] bg-[#0d0d0d]/90 py-2.5 px-3 text-[13px] text-white placeholder:text-white/40 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={runAiSearch}
                    className="ai-search-btn w-full rounded-xl p-[1.5px]"
                  >
                    <span className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#0d0d0d]/90 py-2.5 text-[13px] font-medium text-white/90 transition-colors hover:bg-[#111]/90">
                      <IconSearch size={18} />
                      Search
                    </span>
                  </button>
                </div>
                {aiSearchResult && (
                  <div className="space-y-3">
                    <p className="text-[12px] text-white/80 leading-snug">
                      {aiSearchResult.message}
                    </p>
                    {aiSearchResult.suggestions.length > 0 && (
                      <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {aiSearchResult.suggestions.map((spec) => (
                          <li
                            key={spec.id}
                            className="flex items-center justify-between gap-2 rounded-lg bg-black/30 edge-border px-3 py-2"
                          >
                            <div className="min-w-0">
                              <div className="text-[13px] font-medium truncate">{spec.label}</div>
                              <div className="text-[11px] text-white/55 line-clamp-1">
                                {spec.summary}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                handleAdd(spec.id);
                                setAiSearchOpen(false);
                              }}
                              className="shrink-0 edg-builder-btn edg-builder-sheen inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-semibold"
                            >
                              <IconPlus size={16} tone="brand" />
                              Add
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Internal category rail */}
        <div className="shrink-0 w-[52px] border-r border-white/8 bg-black/15 px-2 py-3">
          <div className="flex flex-col items-center gap-2">
            {CATEGORIES.map((cat) => {
              const active = cat.id === activeCategory;
              const hovered = hoveredCategory === cat.id;
              return (
                <div key={cat.id} className="relative">
                  <EdgazeTooltip open={hovered} text={cat.label} />
                  <button
                    type="button"
                    onMouseEnter={() => setHoveredCategory(cat.id)}
                    onMouseLeave={() => setHoveredCategory(null)}
                    onFocus={() => setHoveredCategory(cat.id)}
                    onBlur={() => setHoveredCategory(null)}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cx(
                      "edg-builder-btn edg-builder-accent-ring h-9 w-9 rounded-2xl grid place-items-center",
                      active ? "text-white" : "text-white/70",
                    )}
                    data-active={active ? "true" : "false"}
                    aria-label={cat.label}
                    title={cat.label}
                  >
                    {cat.icon({ active })}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="library-scroll -mr-3 flex-1 min-h-0 overflow-y-auto pr-4 pb-5">
          {/* Quick start */}
          <div className="px-3 pt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <h4 className="text-[10px] tracking-[0.22em] text-white/55">QUICK START</h4>
              <button
                onClick={() => setShowQS((s) => !s)}
                className="edg-builder-btn h-8 px-3 text-[11px] font-medium"
                type="button"
              >
                {showQS ? "Hide" : "Show"}
              </button>
            </div>
            {showQS && (
              <div className="grid gap-2.5">
                <QuickStartItem
                  icon={<span className="text-[15px]">📧</span>}
                  title="Email Parser"
                  caption="Turn emails into structured data."
                  templateId="email-parser"
                  onLoad={(id) => onLoadQuickStart?.(id)}
                />
                <QuickStartItem
                  icon={<span className="text-[15px]">✍️</span>}
                  title="Writer"
                  caption="Generate posts with AI."
                  templateId="writer"
                  onLoad={(id) => onLoadQuickStart?.(id)}
                />
                <QuickStartItem
                  icon={<span className="text-[15px]">🎨</span>}
                  title="Images"
                  caption="Text-to-image generation."
                  templateId="images"
                  onLoad={(id) => onLoadQuickStart?.(id)}
                />
              </div>
            )}
          </div>

          {/* Node list */}
          <div className="mt-5 space-y-3 px-3">
            {items.map((spec) => {
              const onDragStart = (e: React.DragEvent) => {
                e.dataTransfer.setData(
                  "application/edgaze-node",
                  JSON.stringify({ specId: spec.id }),
                );
                e.dataTransfer.effectAllowed = "move";
              };

              const inputs = spec.ports.filter((p) => p.kind === "input").length;
              const outputs = spec.ports.filter((p) => p.kind === "output").length;

              return (
                <div
                  key={spec.id}
                  className={cx(
                    "group relative overflow-hidden rounded-2xl border border-white/10",
                    "bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))]",
                    "shadow-[0_18px_70px_rgba(0,0,0,0.42)]",
                    "transition-[transform,border-color,background] duration-200",
                    "hover:-translate-y-[1px] hover:border-white/14 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.024))]",
                  )}
                >
                  <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[var(--edgaze-inner-highlight)] opacity-40" />

                  <div className="flex items-start justify-between gap-3 px-4 pt-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold tracking-[-0.01em] text-white/92">
                        {spec.label}
                      </div>
                      <div className="mt-0.5 text-[11px] leading-5 text-white/60 line-clamp-2">
                        {spec.summary}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[10px] font-mono text-white/45">{spec.id}</div>
                      <div className="mt-1 text-[10px] tracking-[0.16em] uppercase text-white/40">
                        {String((spec as any)?.category ?? normalizeCategory(spec)).toString()}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 px-4">
                    <div className="preview-stage rounded-2xl py-4 px-4">
                      <NodePreviewCard spec={spec} onDragStart={onDragStart} />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 px-4 pb-4 text-[11px]">
                    <div className="text-white/55">
                      {inputs} in · {outputs} out
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdd(spec.id)}
                      className="edg-builder-btn-add inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-semibold text-white/92"
                      aria-label="Add to canvas"
                    >
                      <IconPlus size={16} tone="brand" />
                      Add
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="h-3" />
        </div>
      </div>

      {/* Global tweaks for the library visuals (compact, scroll-friendly) */}
      <style jsx global>{`
        .edgaze-no-select {
          user-select: none;
        }

        .preview-stage {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 120px;
          overflow: hidden;
          width: 100%;
          border-radius: 18px;
          background-color: rgba(10, 10, 12, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.08);
          background-image: radial-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px);
          background-size: 14px 14px;
        }

        .preview-stage .node-preview-card {
          flex-shrink: 0;
          box-sizing: border-box;
        }

        .preview-card {
          cursor: grab;
        }
        .preview-card:active {
          cursor: grabbing;
        }

        .edgaze-flow {
          background: linear-gradient(90deg, #78e9ff, #b68cff, #ff6db2, #78e9ff);
          background-size: 260% 100%;
          animation: edgaze-move 9s linear infinite;
        }

        @keyframes edgaze-move {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 260% 50%;
          }
        }

        .safe-area-padding {
          padding-left: max(1rem, env(safe-area-inset-left));
          padding-right: max(1rem, env(safe-area-inset-right));
          padding-top: max(1rem, env(safe-area-inset-top));
          padding-bottom: max(1rem, env(safe-area-inset-bottom));
        }

        .ai-modal-glow {
          background: linear-gradient(120deg, #78e9ff, #b68cff, #ff6db2, #78e9ff, #b68cff);
          background-size: 300% 300%;
          animation: ai-glow-move 8s ease-in-out infinite;
        }

        .ai-input-glow {
          background: linear-gradient(90deg, #78e9ff, #b68cff, #ff6db2, #78e9ff);
          background-size: 280% 100%;
          animation: ai-glow-move 6s linear infinite;
        }

        .ai-search-btn {
          background: linear-gradient(90deg, #78e9ff, #b68cff, #ff6db2, #78e9ff);
          background-size: 280% 100%;
          animation: ai-glow-move 5s linear infinite;
        }

        @keyframes ai-glow-move {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        .library-scroll {
          scrollbar-gutter: stable both-edges;
        }
        .library-scroll::-webkit-scrollbar {
          width: 7px;
        }
        .library-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.18);
          border-radius: 9999px;
        }
        .library-scroll::-webkit-scrollbar-track {
          background: transparent !important;
        }
      `}</style>
    </div>
  );
}

export default memo(BlockLibrary);

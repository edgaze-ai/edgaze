"use client";

import { useMemo, useState, useEffect, useRef, memo, type ReactElement } from "react";
import { listNodeSpecs } from "src/nodes/registry";
import { matchNodesFromNaturalLanguage } from "src/nodes/nodeSearch";
import type { NodeSpec } from "src/nodes/types";
import {
  IconClose,
  IconConditions,
  IconCore,
  IconGrid,
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
  icon: (p: { active?: boolean; size?: number }) => ReactElement;
};

const CATEGORIES: LibraryCategory[] = [
  {
    id: "all",
    label: "All",
    icon: ({ active, size = 18 }) => <IconGrid size={size} tone={active ? "brand" : "muted"} />,
  },
  {
    id: "core",
    label: "Core",
    icon: ({ active, size = 18 }) => <IconCore size={size} tone={active ? "brand" : "muted"} />,
  },
  {
    id: "llm",
    label: "LLM",
    icon: ({ active, size = 18 }) => <IconLLM size={size} tone={active ? "brand" : "muted"} />,
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: ({ active, size = 18 }) => (
      <IconIntegrations size={size} tone={active ? "brand" : "muted"} />
    ),
  },
  {
    id: "conditions",
    label: "Conditions",
    icon: ({ active, size = 18 }) => (
      <IconConditions size={size} tone={active ? "brand" : "muted"} />
    ),
  },
  {
    id: "loops",
    label: "Loops",
    icon: ({ active, size = 18 }) => <IconLoops size={size} tone={active ? "brand" : "muted"} />,
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
  compact,
  icon,
  title,
  caption,
  templateId,
  onLoad,
}: {
  compact?: boolean;
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
        "group relative flex w-full items-center overflow-hidden text-left",
        compact ? "gap-2 rounded-xl px-1 py-1" : "gap-3 rounded-2xl",
        "border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))]",
        "shadow-[0_18px_70px_rgba(0,0,0,0.42)]",
        "transition-[transform,background,border-color] duration-200",
        "hover:-translate-y-[1px] hover:border-white/14 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.024))]",
      )}
    >
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-[var(--edgaze-inner-highlight)] opacity-40" />
      <div
        className={cx(
          "grid shrink-0 place-items-center rounded-lg border border-white/10 bg-black/25",
          compact ? "h-7 w-7" : "h-9 w-9 rounded-xl",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 py-0.5">
        <div className="flex items-center gap-1.5">
          <div
            className={cx(
              "font-semibold tracking-[-0.01em] text-white/92",
              compact ? "text-[11px]" : "text-[12px]",
            )}
          >
            {title}
          </div>
          <span
            className={cx(
              "opacity-55 shrink-0 tracking-[0.14em] uppercase text-white/45",
              compact ? "text-[8px]" : "text-[10px]",
            )}
          >
            Open
          </span>
        </div>
        {!compact && (
          <div className={cx("truncate text-white/60", compact ? "text-[9px]" : "text-[11px]")}>
            {caption}
          </div>
        )}
      </div>
    </button>
  );
}

/* ---------- Block library ---------- */
function BlockLibrary({
  compact,
  onAdd,
  onLoadQuickStart,
}: {
  compact?: boolean;
  onAdd?: (specId: string) => void;
  onLoadQuickStart?: (templateId: string) => void;
}) {
  const [q, setQ] = useState("");
  const [showQS, setShowQS] = useState(!compact);
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

  const iconSize = compact ? 14 : 18;

  return (
    <div className={cx("relative flex h-full flex-col", compact && "library-compact")}>
      {/* Search + AI button */}
      <div className={cx(compact ? "px-1 pt-1" : "px-3 pt-3")}>
        <div className="relative">
          <div
            className={cx(
              "pointer-events-none absolute top-1/2 -translate-y-1/2 text-white/55",
              compact ? "left-2.5" : "left-3",
            )}
          >
            <IconSearch size={compact ? 14 : 18} />
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search blocks..."
            className={cx(
              "w-full border border-white/10 bg-black/25 text-white/92 placeholder:text-white/35",
              compact
                ? "rounded-xl py-1.5 pl-8 pr-8 text-[11px]"
                : "rounded-2xl py-2.5 pl-10 pr-10 text-[12px]",
              "outline-none transition-[border-color,background] duration-200 focus:border-white/18 focus:bg-black/30",
            )}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className={cx(
                "absolute top-1/2 -translate-y-1/2 edg-builder-btn rounded-full grid place-items-center",
                compact ? "right-1.5 h-6 w-6" : "right-2 h-8 w-8",
              )}
              title="Clear search"
            >
              <IconClose size={compact ? 14 : 16} className="text-white/70" />
            </button>
          )}
        </div>

        <div className={cx("flex items-center gap-2", compact ? "mt-1" : "mt-2")}>
          <button
            className={cx(
              "edgaze-flow w-full p-[1.2px]",
              compact ? "rounded-xl" : "rounded-[16px]",
            )}
            title="Search nodes with AI"
            type="button"
            onClick={() => setAiSearchOpen(true)}
          >
            <div
              className={cx(
                "relative flex w-full items-center justify-center bg-[#0f0f10] font-medium text-white/90",
                compact
                  ? "gap-1.5 rounded-[11px] px-2 py-1.5 text-[10px] leading-tight"
                  : "gap-2 rounded-[14px] px-3 py-2.5 text-[12px]",
              )}
            >
              <IconSpark size={compact ? 13 : 18} tone="brand" />
              <span className={compact ? "truncate" : undefined}>
                {compact ? "AI search" : "Search nodes with AI"}
              </span>
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
        <div
          className={cx(
            "shrink-0 border-r border-white/8 bg-black/15",
            compact ? "w-[34px] px-0.5 py-1.5" : "w-[52px] px-2 py-3",
          )}
        >
          <div className={cx("flex flex-col items-center", compact ? "gap-1" : "gap-2")}>
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
                      "edg-builder-btn edg-builder-accent-ring grid place-items-center",
                      compact ? "h-6.5 w-6.5 rounded-xl" : "h-9 w-9 rounded-2xl",
                      active ? "text-white" : "text-white/70",
                    )}
                    data-active={active ? "true" : "false"}
                    aria-label={cat.label}
                    title={cat.label}
                  >
                    {cat.icon({ active, size: iconSize })}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div
          className={cx(
            "library-scroll -mr-3 flex-1 min-h-0 overflow-y-auto",
            compact ? "pr-2 pb-3" : "pr-4 pb-5",
          )}
        >
          {/* Quick start */}
          <div className={cx(compact ? "px-1.5 pt-1.5" : "px-3 pt-3")}>
            <div className={cx("flex items-center justify-between", compact ? "mb-1" : "mb-1.5")}>
              <h4
                className={cx(
                  "tracking-[0.22em] text-white/55",
                  compact ? "text-[8px]" : "text-[10px]",
                )}
              >
                QUICK START
              </h4>
              <button
                onClick={() => setShowQS((s) => !s)}
                className={cx(
                  "edg-builder-btn font-medium",
                  compact ? "h-6 px-2 text-[9px]" : "h-8 px-3 text-[11px]",
                )}
                type="button"
              >
                {showQS ? "Hide" : "Show"}
              </button>
            </div>
            {showQS && (
              <div className={cx("grid", compact ? "gap-1.5" : "gap-2.5")}>
                <QuickStartItem
                  compact={compact}
                  icon={<span className={compact ? "text-[12px]" : "text-[15px]"}>📧</span>}
                  title="Email Parser"
                  caption="Turn emails into structured data."
                  templateId="email-parser"
                  onLoad={(id) => onLoadQuickStart?.(id)}
                />
                <QuickStartItem
                  compact={compact}
                  icon={<span className={compact ? "text-[12px]" : "text-[15px]"}>✍️</span>}
                  title="Writer"
                  caption="Generate posts with AI."
                  templateId="writer"
                  onLoad={(id) => onLoadQuickStart?.(id)}
                />
                <QuickStartItem
                  compact={compact}
                  icon={<span className={compact ? "text-[12px]" : "text-[15px]"}>🎨</span>}
                  title="Images"
                  caption="Text-to-image generation."
                  templateId="images"
                  onLoad={(id) => onLoadQuickStart?.(id)}
                />
              </div>
            )}
          </div>

          {/* Node list */}
          <div className={cx(compact ? "mt-2 space-y-1.5 px-1" : "mt-5 space-y-3 px-3")}>
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
                    "group relative overflow-hidden border border-white/10",
                    "bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))]",
                    "shadow-[0_18px_70px_rgba(0,0,0,0.42)]",
                    "transition-[transform,border-color,background] duration-200",
                    "hover:-translate-y-[1px] hover:border-white/14 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.024))]",
                    compact ? "rounded-xl" : "rounded-2xl",
                  )}
                >
                  <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[var(--edgaze-inner-highlight)] opacity-40" />

                  <div
                    className={cx(
                      "flex items-start justify-between",
                      compact ? "gap-2 px-2 pt-2" : "gap-3 px-4 pt-3",
                    )}
                  >
                    <div className="min-w-0 flex-1 pr-1">
                      <div
                        className={cx(
                          "break-words font-semibold tracking-[-0.01em] text-white/92",
                          compact
                            ? "line-clamp-2 text-[12px] leading-snug"
                            : "line-clamp-2 text-[13px] leading-snug",
                        )}
                      >
                        {spec.label}
                      </div>
                      {!compact && (
                        <div
                          className={cx(
                            "mt-0.5 text-white/60",
                            compact
                              ? "line-clamp-2 text-[9px] leading-snug"
                              : "line-clamp-2 text-[11px] leading-snug",
                          )}
                        >
                          {spec.summary}
                        </div>
                      )}
                    </div>
                    {!compact && (
                      <div
                        className={cx(
                          "shrink-0 text-right",
                          compact ? "w-[3.25rem]" : "w-[4.25rem]",
                        )}
                      >
                        <div
                          className={cx(
                            "truncate font-mono text-white/45",
                            compact ? "text-[9px]" : "text-[10px]",
                          )}
                          title={spec.id}
                        >
                          {spec.id}
                        </div>
                        <div
                          className={cx(
                            "mt-1 truncate tracking-[0.12em] uppercase text-white/40",
                            compact ? "text-[8px]" : "text-[10px]",
                          )}
                          title={String(
                            (spec as any)?.category ?? normalizeCategory(spec),
                          ).toString()}
                        >
                          {String((spec as any)?.category ?? normalizeCategory(spec)).toString()}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={cx(compact ? "mt-1.5 px-2" : "mt-3 px-4")}>
                    <div
                      className={cx(
                        "preview-stage",
                        compact ? "rounded-lg px-1 py-1" : "rounded-2xl py-4 px-4",
                      )}
                    >
                      <NodePreviewCard spec={spec} compact={compact} onDragStart={onDragStart} />
                    </div>
                  </div>

                  <div
                    className={cx(
                      "flex items-center justify-between gap-2",
                      compact ? "mt-1.5 px-2 pb-2 text-[10px]" : "mt-3 px-4 pb-4 text-[11px]",
                    )}
                  >
                    <div className="text-white/55">
                      {inputs} in · {outputs} out
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdd(spec.id)}
                      className={cx(
                        "edg-builder-btn-add inline-flex items-center rounded-full font-semibold text-white/92",
                        compact ? "gap-1 px-2.5 py-1 text-[10px]" : "gap-2 px-3 py-2 text-[11px]",
                      )}
                      aria-label="Add to canvas"
                    >
                      <IconPlus size={compact ? 12 : 16} tone="brand" />
                      Add
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={compact ? "h-2" : "h-3"} />
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
          min-height: 96px;
          overflow: hidden;
          width: 100%;
          border-radius: 18px;
          background-color: rgba(10, 10, 12, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.08);
          background-image: radial-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px);
          background-size: 14px 14px;
        }

        .library-compact .preview-stage {
          min-height: 42px;
          border-radius: 10px;
          background-size: 10px 10px;
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

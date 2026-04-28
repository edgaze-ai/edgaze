"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Play,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { extractWorkflowInputs } from "@/lib/workflow/input-extraction";
import type { WorkflowInput } from "@/lib/workflow/run-types";
import type { WorkflowRunState } from "./PremiumWorkflowRunModal";

type LaunchIntent = "image" | "writing" | "custom";
type LaunchStep = "intent" | "draft" | "preview" | "inputs" | "position" | "share";

type PublishPrefill = {
  title?: string;
  description?: string;
  priceUsd?: string;
  monetisationMode?: "free" | "paywall";
  tags?: string;
};

type DraftLike = {
  id: string;
  title?: string;
  graph?: any;
};

type Props = {
  open: boolean;
  authReady: boolean;
  userId: string | null;
  draft: DraftLike | null;
  graph: { nodes: any[]; edges: any[] } | null;
  creating?: boolean;
  running?: boolean;
  runState: WorkflowRunState | null;
  publishedUrl?: string | null;
  error?: string | null;
  onRequireAuth: () => boolean;
  onClose: () => void;
  onOpenTemplates: () => void;
  onCreateQuickStart: (id: "images" | "writer") => Promise<void>;
  onCreatePromptDraft: (args: {
    prompt: string;
    intent: LaunchIntent;
    title?: string;
  }) => Promise<void>;
  onPreview: () => void;
  onUpdateInputNode: (nodeId: string, patch: Record<string, unknown>) => Promise<void>;
  onPublish: (prefill: PublishPrefill) => void;
  onAdvancedEdit: () => void;
  onCopyShare: (text: string) => Promise<void>;
};

const STEPS: Array<{ key: LaunchStep; label: string }> = [
  { key: "intent", label: "Pick" },
  { key: "draft", label: "Build" },
  { key: "preview", label: "Preview" },
  { key: "inputs", label: "Inputs" },
  { key: "position", label: "Publish" },
  { key: "share", label: "Share" },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function stepIndex(step: LaunchStep) {
  return STEPS.findIndex((item) => item.key === step);
}

function summarizePrompt(prompt: string) {
  const clean = prompt.replace(/\s+/g, " ").trim();
  if (!clean) return "a useful AI result";
  return clean.length > 84 ? `${clean.slice(0, 84).trim()}...` : clean;
}

function defaultTitleForIntent(intent: LaunchIntent) {
  if (intent === "image") return "AI Image Style Workflow";
  if (intent === "writing") return "Content Writing Workflow";
  return "Custom AI Workflow";
}

function outputPreviewFromRun(runState: WorkflowRunState | null) {
  const first = runState?.outputs?.[0]?.value;
  if (first == null) return "";
  if (typeof first === "string") return first;
  try {
    return JSON.stringify(first, null, 2);
  } catch {
    return String(first);
  }
}

function IntentCard({
  title,
  description,
  icon,
  active,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "group min-h-[128px] rounded-[22px] border p-5 text-left transition-all duration-300",
        "bg-white/[0.028] hover:-translate-y-0.5 hover:bg-white/[0.055] active:translate-y-0",
        active
          ? "border-cyan-200/45 shadow-[0_18px_70px_rgba(34,211,238,0.16),inset_0_1px_0_rgba(255,255,255,0.08)]"
          : "border-white/10 hover:border-white/18 hover:shadow-[0_16px_54px_rgba(0,0,0,0.28)]",
      )}
    >
      <div
        className={cx(
          "mb-4 inline-flex text-white/68 transition-all duration-300 group-hover:scale-105 group-hover:text-cyan-100",
          active && "text-cyan-100",
        )}
      >
        {icon}
      </div>
      <div className="text-[15px] font-semibold text-white">{title}</div>
      <div className="mt-2 text-sm leading-5 text-white/55">{description}</div>
    </button>
  );
}

function FieldEditor({
  input,
  busy,
  onUpdate,
}: {
  input: WorkflowInput;
  busy?: boolean;
  onUpdate: (patch: Record<string, unknown>) => void;
}) {
  const [question, setQuestion] = useState(input.name ?? "");
  const [type, setType] = useState(input.type ?? "text");
  const [placeholder, setPlaceholder] = useState(input.placeholder ?? "");
  const [required, setRequired] = useState(input.required !== false);

  const commit = () =>
    onUpdate({
      question,
      inputType: type,
      placeholder,
      required,
    });

  return (
    <div className="rounded-[22px] border border-white/10 bg-black/22 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:border-white/16 hover:bg-white/[0.035]">
      <label className="text-xs font-medium uppercase tracking-[0.16em] text-white/38">
        Field label
      </label>
      <input
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        onBlur={commit}
        className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 text-[15px] text-white outline-none transition-colors focus:border-cyan-300/45 focus:bg-white/[0.06]"
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div>
          <label className="text-xs font-medium uppercase tracking-[0.16em] text-white/38">
            Type
          </label>
          <select
            value={type}
            onChange={(event) => {
              const nextType = event.target.value as WorkflowInput["type"];
              setType(nextType);
              onUpdate({ inputType: nextType });
            }}
            className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#101010] px-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/45"
          >
            <option value="text">Text</option>
            <option value="textarea">Long text</option>
            <option value="number">Number</option>
            <option value="url">URL</option>
            <option value="dropdown">Dropdown</option>
            <option value="json">JSON</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-[0.16em] text-white/38">
            Placeholder
          </label>
          <input
            value={placeholder}
            onChange={(event) => setPlaceholder(event.target.value)}
            onBlur={commit}
            className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 text-sm text-white outline-none transition-colors focus:border-cyan-300/45 focus:bg-white/[0.06]"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          const next = !required;
          setRequired(next);
          onUpdate({ required: next });
        }}
        disabled={busy}
        className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white/80 transition-all hover:border-cyan-200/20 hover:bg-cyan-200/[0.06]"
      >
        <span
          className={cx(
            "grid h-5 w-5 place-items-center rounded-md border transition-colors",
            required ? "border-cyan-300/60 bg-cyan-300/20" : "border-white/18",
          )}
        >
          {required ? <Check className="h-3.5 w-3.5" /> : null}
        </span>
        Required
      </button>
    </div>
  );
}

export default function CreatorLaunchFlow({
  open,
  authReady,
  userId,
  draft,
  graph,
  creating = false,
  running = false,
  runState,
  publishedUrl,
  error,
  onRequireAuth,
  onClose,
  onOpenTemplates,
  onCreateQuickStart,
  onCreatePromptDraft,
  onPreview,
  onUpdateInputNode,
  onPublish,
  onAdvancedEdit,
  onCopyShare,
}: Props) {
  const [step, setStep] = useState<LaunchStep>("intent");
  const [intent, setIntent] = useState<LaunchIntent | null>(null);
  const [prompt, setPrompt] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [inputBusyId, setInputBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceUsd, setPriceUsd] = useState("5.99");

  const inputs = useMemo(() => extractWorkflowInputs(graph?.nodes ?? []), [graph]);
  const outputPreview = outputPreviewFromRun(runState);
  const hasDraft = Boolean(draft?.id);

  useEffect(() => {
    if (!open) return;
    if (publishedUrl) {
      setStep("share");
      return;
    }
    if (draft?.id && step === "intent") {
      setStep("preview");
    }
  }, [draft?.id, open, publishedUrl, step]);

  useEffect(() => {
    if (!draft?.title) return;
    setTitle((current) => current || draft.title || "");
  }, [draft?.title]);

  useEffect(() => {
    if (!prompt.trim()) return;
    setDescription(
      (current) => current || `Generate ${summarizePrompt(prompt).toLowerCase()} in seconds.`,
    );
  }, [prompt]);

  if (!open) return null;

  const progress = Math.max(0, stepIndex(step));
  const canCreateCustom = prompt.trim().length >= 12 && !creating;
  const primaryDisabled =
    (step === "draft" && !canCreateCustom) ||
    (step === "preview" && !hasDraft) ||
    (step === "position" && !hasDraft);

  const primaryLabel =
    step === "intent"
      ? "Continue"
      : step === "draft"
        ? creating
          ? "Creating..."
          : "Create workflow draft"
        : step === "preview"
          ? running
            ? "Running..."
            : "Run preview"
          : step === "inputs"
            ? "Preview again"
            : step === "position"
              ? "Publish workflow"
              : "Copy link";

  const handlePrimary = async () => {
    setLocalError(null);
    if (!authReady) return;
    if (!userId && !onRequireAuth()) return;

    try {
      if (step === "intent") {
        if (!intent) {
          setLocalError("Choose what you want to sell first.");
          return;
        }
        if (intent === "image") {
          await onCreateQuickStart("images");
          setTitle(defaultTitleForIntent("image"));
          setDescription("Generate polished image concepts from a buyer's prompt.");
          setStep("preview");
          return;
        }
        if (intent === "writing") {
          await onCreateQuickStart("writer");
          setTitle(defaultTitleForIntent("writing"));
          setDescription("Generate ready-to-use writing from a buyer's topic.");
          setStep("preview");
          return;
        }
        setStep("draft");
        return;
      }

      if (step === "draft") {
        await onCreatePromptDraft({
          prompt,
          intent: intent ?? "custom",
          title: title || defaultTitleForIntent(intent ?? "custom"),
        });
        setStep("preview");
        return;
      }

      if (step === "preview") {
        if (!inputs.length) {
          setLocalError("No input nodes found. Add or edit inputs before previewing.");
          setStep("inputs");
          return;
        }
        onPreview();
        return;
      }

      if (step === "inputs") {
        setStep("preview");
        return;
      }

      if (step === "position") {
        onPublish({
          title: title || draft?.title || defaultTitleForIntent(intent ?? "custom"),
          description:
            description ||
            `Generate ${intent === "image" ? "images" : "a polished result"} in seconds.`,
          priceUsd,
          monetisationMode: "paywall",
          tags:
            intent === "image"
              ? "image,style,ai"
              : intent === "writing"
                ? "writing,content,ai"
                : "workflow,ai",
        });
        return;
      }

      if (step === "share" && publishedUrl) {
        await onCopyShare(publishedUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }
    } catch (err: any) {
      setLocalError(err?.message || "Something went wrong.");
    }
  };

  return (
    <div className="fixed inset-0 z-[90] overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(34,211,238,0.13),transparent_26%,rgba(244,114,182,0.08)_58%,transparent_82%),radial-gradient(ellipse_at_top,rgba(255,255,255,0.08),transparent_42%),linear-gradient(180deg,#050505,#080809_48%,#030303)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="relative flex h-full flex-col">
        <header className="shrink-0 border-b border-white/10 bg-black/24 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
                Creator launch
              </div>
              <div className="mt-1 truncate text-sm text-white/70">
                {draft?.title || "Build a workflow people can run"}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white/62 transition-all hover:bg-white/[0.06] hover:text-white"
              aria-label="Close launch flow"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mx-auto mt-4 max-w-6xl">
            <div className="flex gap-1.5">
              {STEPS.map((item, index) => (
                <div
                  key={item.key}
                  className={cx(
                    "h-1.5 flex-1 rounded-full transition-all duration-300",
                    index <= progress
                      ? "bg-[linear-gradient(90deg,#67e8f9,#f0abfc)] shadow-[0_0_18px_rgba(103,232,249,0.24)]"
                      : "bg-white/10",
                  )}
                />
              ))}
            </div>
            <div className="mt-2 hidden justify-between text-[11px] text-white/38 sm:flex">
              {STEPS.map((item) => (
                <span key={item.key}>{item.label}</span>
              ))}
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-3 pb-32 pt-5 sm:px-6 sm:pb-10 sm:pt-10">
          <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <section className="min-w-0 rounded-[26px] border border-white/10 bg-black/28 p-5 shadow-[0_30px_100px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl sm:p-8">
              {step === "intent" && (
                <div>
                  <h1 className="text-[2rem] font-semibold leading-[1.02] tracking-[-0.04em] text-white sm:text-5xl">
                    What do you want to sell?
                  </h1>
                  <div className="mt-7 grid gap-3 sm:grid-cols-3">
                    <IntentCard
                      title="AI Image Style"
                      description="Launch a visual workflow from the existing image quick start."
                      icon={<ImageIcon className="h-5 w-5" />}
                      active={intent === "image"}
                      onClick={() => setIntent("image")}
                    />
                    <IntentCard
                      title="Content / Writing Workflow"
                      description="Start with the existing writing workflow path."
                      icon={<FileText className="h-5 w-5" />}
                      active={intent === "writing"}
                      onClick={() => setIntent("writing")}
                    />
                    <IntentCard
                      title="Custom Prompt"
                      description="Paste your prompt and turn it into a real workflow draft."
                      icon={<Wand2 className="h-5 w-5" />}
                      active={intent === "custom"}
                      onClick={() => setIntent("custom")}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={onOpenTemplates}
                    className="mt-5 inline-flex h-12 items-center gap-2 rounded-xl px-4 text-sm font-medium text-white/72 transition-all hover:bg-white/[0.06] hover:text-white"
                  >
                    <Sparkles className="h-4 w-4" />
                    Browse full template library
                  </button>
                </div>
              )}

              {step === "draft" && (
                <div>
                  <h1 className="text-[2rem] font-semibold leading-[1.02] tracking-[-0.04em] text-white sm:text-5xl">
                    Paste the prompt behind your product.
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/58">
                    Edgaze will create a normal workflow draft with input nodes, an AI generator,
                    and an output node.
                  </p>
                  <textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Paste the prompt, style recipe, or workflow instructions people should be able to run..."
                    className="mt-7 min-h-[230px] w-full resize-y rounded-2xl border border-white/10 bg-black/30 p-4 text-[15px] leading-6 text-white outline-none transition-colors placeholder:text-white/30 focus:border-cyan-300/45 focus:bg-black/20"
                  />
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Product title, optional"
                    className="mt-4 h-14 w-full rounded-2xl border border-white/10 bg-black/24 px-4 text-[15px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-cyan-300/45 focus:bg-black/20"
                  />
                </div>
              )}

              {step === "preview" && (
                <div>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h1 className="text-[2rem] font-semibold leading-[1.02] tracking-[-0.04em] text-white sm:text-5xl">
                        This is what your workflow produces
                      </h1>
                      <p className="mt-3 text-sm leading-6 text-white/58">
                        Run a buyer-style preview before you publish.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep("inputs")}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-white/75 transition-all hover:bg-white/[0.06] hover:text-white"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit inputs
                    </button>
                  </div>

                  <div className="mt-7 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/22 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <div className="text-xs font-medium uppercase tracking-[0.16em] text-white/38">
                        Buyer inputs
                      </div>
                      <div className="mt-4 space-y-3">
                        {inputs.length ? (
                          inputs.map((input) => (
                            <div
                              key={input.nodeId}
                              className="rounded-xl border border-white/10 bg-white/[0.03] p-3 transition-colors hover:border-cyan-200/18 hover:bg-white/[0.05]"
                            >
                              <div className="text-sm font-medium text-white">{input.name}</div>
                              <div className="mt-1 text-xs text-white/45">
                                {input.type} {input.required ? "required" : "optional"}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-50/85">
                            No input nodes found. Add inputs before previewing.
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/22 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <div className="text-xs font-medium uppercase tracking-[0.16em] text-white/38">
                        Output preview
                      </div>
                      <pre className="mt-4 min-h-[210px] whitespace-pre-wrap rounded-xl border border-white/10 bg-[#070707] p-4 text-sm leading-6 text-white/72">
                        {outputPreview ||
                          "Run preview to see the workflow output here. The existing run modal will collect inputs and execute the draft."}
                      </pre>
                    </div>
                  </div>
                  {runState?.status === "success" ? (
                    <button
                      type="button"
                      onClick={() => setStep("position")}
                      className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-black shadow-[0_18px_60px_rgba(255,255,255,0.12)] transition-all hover:-translate-y-0.5 hover:bg-white/90"
                    >
                      Looks good, continue
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              )}

              {step === "inputs" && (
                <div>
                  <h1 className="text-[2rem] font-semibold leading-[1.02] tracking-[-0.04em] text-white sm:text-5xl">
                    Review the buyer inputs
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-white/58">
                    These fields update the actual input node config in your draft.
                  </p>
                  <div className="mt-7 space-y-4">
                    {inputs.length ? (
                      inputs.map((input) => (
                        <FieldEditor
                          key={input.nodeId}
                          input={input}
                          busy={inputBusyId === input.nodeId}
                          onUpdate={async (patch) => {
                            setInputBusyId(input.nodeId);
                            try {
                              await onUpdateInputNode(input.nodeId, patch);
                            } finally {
                              setInputBusyId(null);
                            }
                          }}
                        />
                      ))
                    ) : (
                      <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5 text-sm text-amber-50/85">
                        No input nodes found. Use Advanced edit in builder to add an input node.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === "position" && (
                <div>
                  <h1 className="text-[2rem] font-semibold leading-[1.02] tracking-[-0.04em] text-white sm:text-5xl">
                    Price and position it
                  </h1>
                  <div className="mt-7 grid gap-4">
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Workflow title"
                      className="h-14 rounded-2xl border border-white/10 bg-black/24 px-4 text-[15px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-cyan-300/45 focus:bg-black/20"
                    />
                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Short product description"
                      className="min-h-[120px] rounded-2xl border border-white/10 bg-black/24 p-4 text-[15px] leading-6 text-white outline-none transition-colors placeholder:text-white/30 focus:border-cyan-300/45 focus:bg-black/20"
                    />
                    <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                      <label className="block">
                        <span className="text-xs font-medium uppercase tracking-[0.16em] text-white/38">
                          Price
                        </span>
                        <div className="mt-2 flex h-14 items-center rounded-2xl border border-white/10 bg-black/24 px-4 transition-colors focus-within:border-cyan-300/45">
                          <span className="text-white/45">$</span>
                          <input
                            value={priceUsd}
                            onChange={(event) => setPriceUsd(event.target.value)}
                            inputMode="decimal"
                            className="h-full min-w-0 flex-1 bg-transparent pl-2 text-[15px] text-white outline-none"
                          />
                        </div>
                      </label>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-white/64">
                        Generate {intent === "image" ? "a visual result" : "a polished output"}{" "}
                        using {intent === "custom" ? "your workflow" : "your style"} in seconds.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === "share" && (
                <div>
                  <h1 className="text-[2rem] font-semibold leading-[1.02] tracking-[-0.04em] text-white sm:text-5xl">
                    Your workflow is live
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-white/58">
                    Copy the link, open the product page, or share it when you are ready.
                  </p>
                  <div className="mt-7 rounded-2xl border border-white/10 bg-black/22 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <div className="break-all text-sm text-white/78">{publishedUrl}</div>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={handlePrimary}
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-black shadow-[0_18px_60px_rgba(255,255,255,0.12)] transition-all hover:-translate-y-0.5 hover:bg-white/90"
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? "Copied" : "Copy link"}
                      </button>
                      {publishedUrl ? (
                        <a
                          href={publishedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium text-white/78 transition-all hover:bg-white/[0.06] hover:text-white"
                        >
                          Open product page
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-white/70">
                    I turned my AI workflow into something you can actually run.
                    <br />
                    <br />
                    Try it here: {publishedUrl || "[link]"}
                  </div>
                </div>
              )}

              {(localError || error) && (
                <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">
                  {localError || error}
                </div>
              )}
            </section>

            <aside className="hidden space-y-4 lg:block">
              <div className="rounded-[24px] border border-white/10 bg-black/24 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
                <div className="text-sm font-semibold text-white">Launch path</div>
                <div className="mt-4 space-y-3">
                  {STEPS.map((item, index) => (
                    <div key={item.key} className="flex items-center gap-3">
                      <div
                        className={cx(
                          "grid h-7 w-7 place-items-center rounded-full border text-xs transition-colors",
                          index <= progress
                            ? "border-cyan-300/50 bg-cyan-300/16 text-cyan-100"
                            : "border-white/10 text-white/35",
                        )}
                      >
                        {index < progress ? <Check className="h-3.5 w-3.5" /> : index + 1}
                      </div>
                      <span className={index <= progress ? "text-white/78" : "text-white/36"}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={onAdvancedEdit}
                disabled={!hasDraft}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-white/68 transition-all hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
              >
                Advanced edit in builder
                <ArrowRight className="h-4 w-4" />
              </button>
            </aside>
          </div>
        </main>

        {step !== "share" && (
          <div className="fixed inset-x-0 bottom-0 z-10 border-t border-white/10 bg-black/82 px-4 py-3 backdrop-blur-xl sm:hidden">
            <button
              type="button"
              onClick={handlePrimary}
              disabled={primaryDisabled || creating || running}
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#ffffff,#dffaff)] px-5 text-[15px] font-semibold text-black shadow-[0_18px_56px_rgba(103,232,249,0.18)] transition-transform active:scale-[0.99] disabled:opacity-50"
            >
              {creating || running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {primaryLabel}
            </button>
          </div>
        )}

        {step !== "share" && (
          <div className="hidden shrink-0 border-t border-white/10 bg-black/44 px-6 py-4 backdrop-blur-xl sm:block">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => {
                  const index = stepIndex(step);
                  if (index <= 0) return;
                  setStep(STEPS[index - 1]?.key ?? "intent");
                }}
                className="h-12 rounded-xl px-5 text-sm font-medium text-white/70 transition-all hover:bg-white/[0.06] hover:text-white disabled:opacity-35"
                disabled={step === "intent"}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handlePrimary}
                disabled={primaryDisabled || creating || running}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#ffffff,#dffaff)] px-6 text-sm font-semibold text-black shadow-[0_18px_56px_rgba(103,232,249,0.14)] transition-all hover:-translate-y-0.5 hover:bg-white/90 disabled:opacity-50"
              >
                {creating || running ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {primaryLabel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

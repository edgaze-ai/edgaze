"use client";

import React, { Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Clock3,
  Copy,
  Download,
  Expand,
  Minimize2,
  Loader2,
  RefreshCcw,
  Sparkles,
  StopCircle,
} from "lucide-react";

import { cx } from "../../../lib/cx";
import {
  deriveCustomerRuntimeModel,
  formatRunElapsed,
} from "../../../lib/workflow/customer-runtime";
import type { WorkflowInput, WorkflowRunState } from "../../../lib/workflow/run-types";
import { isPremiumAiSpec, providerForAiSpec } from "../../../lib/workflow/spec-id-aliases";
import { WorkflowInputField } from "../../builder/WorkflowInputField";
import { UserApiKeysDialog } from "../../settings/UserApiKeysDialog";
import { bearerAuthHeaders } from "../../../lib/auth/bearer-headers";
import { useAuth } from "../../auth/AuthContext";
import type { Components } from "react-markdown";
import CustomerLiveExecutionPanel from "./CustomerLiveExecutionPanel";

type BuilderRunLimit = {
  used: number;
  limit: number;
  isAdmin?: boolean;
};

type CustomerWorkflowRuntimeSurfaceProps = {
  state: WorkflowRunState | null;
  onCancel?: () => void;
  onClose?: () => void;
  onRerun?: () => void;
  onSubmitInputs?: (values: Record<string, any>) => void;
  embedded?: boolean;
  hideHeader?: boolean;
  hideActionZone?: boolean;
  isBuilderTest?: boolean;
  builderRunLimit?: BuilderRunLimit;
  requiresApiKeys?: string[];
  onBuyWorkflow?: () => void;
};

function isImageLike(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (value.startsWith("data:image/")) return true;
  return /^(https?:\/\/.*\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?)$/i.test(value);
}

function useImageObjectUrl(value: unknown) {
  const [url, setUrl] = useState<string | null>(null);
  const [isDataUrl, setIsDataUrl] = useState(false);

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;

    async function run() {
      if (typeof value !== "string") {
        setIsDataUrl(false);
        setUrl(null);
        return;
      }
      const trimmed = value.trim();
      const dataUrl = trimmed.startsWith("data:image/");
      setIsDataUrl(dataUrl);
      if (!dataUrl) {
        setUrl(trimmed);
        return;
      }

      try {
        // Convert the huge data URL into a short-lived blob URL so "Open image" works reliably
        // (some browsers will fail/navigate to about:blank for very large data: URLs).
        const blob = await (await fetch(trimmed)).blob();
        objectUrl = URL.createObjectURL(blob);
        if (!alive) return;
        setUrl(objectUrl);
      } catch {
        // Fallback: keep the original data URL (still renders inline via <img src>)
        if (!alive) return;
        setUrl(trimmed);
      }
    }

    run();

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [value]);

  return { url, isDataUrl };
}

function isProbablyFileUrl(value: unknown): boolean {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function formatOutputLabel(label?: string) {
  if (!label || !label.trim()) return "Result";
  return label.trim();
}

function copyText(text: string) {
  return navigator.clipboard.writeText(text);
}

function downloadValue(filename: string, value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function isProbablyMarkdown(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.includes("```")) return true;
  if (/(^|\n)#{1,6}\s+\S/.test(t)) return true;
  if (/(^|\n)>\s+\S/.test(t)) return true;
  if (/(^|\n)(-|\*|\+)\s+\S/.test(t)) return true;
  if (/(^|\n)\d+\.\s+\S/.test(t)) return true;
  if (/\[[^\]]+\]\([^)]+\)/.test(t)) return true;
  if (/(^|\n)\|(.+\|)+\s*(\n\|[-:\s|]+\|)/.test(t)) return true; // table
  if (/`[^`\n]+`/.test(t)) return true;
  return false;
}

const LazyMarkdown = React.lazy(async () => {
  const [{ default: ReactMarkdown }, { default: remarkGfm }] = await Promise.all([
    import("react-markdown"),
    import("remark-gfm"),
  ]);

  const components: Components = {
    a: (props) => (
      <a
        {...props}
        className={cx(
          "text-cyan-200/90 underline underline-offset-4 decoration-white/20 hover:text-cyan-100",
          props.className,
        )}
        target="_blank"
        rel="noreferrer"
      />
    ),
    code: (props) => {
      const inline =
        !("data-language" in props) && !String(props.className ?? "").includes("language-");
      if (inline) {
        return (
          <code
            {...props}
            className={cx(
              "rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[0.95em] text-white/90",
              props.className,
            )}
          />
        );
      }
      return (
        <code
          {...props}
          className={cx(
            "block whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/40 p-4 text-[13px] leading-6 text-white/90",
            props.className,
          )}
        />
      );
    },
    pre: (props) => <pre {...props} className={cx("overflow-auto", props.className)} />,
    h1: (props) => (
      <h1 {...props} className={cx("mt-2 text-[22px] font-semibold text-white", props.className)} />
    ),
    h2: (props) => (
      <h2 {...props} className={cx("mt-6 text-[18px] font-semibold text-white", props.className)} />
    ),
    h3: (props) => (
      <h3 {...props} className={cx("mt-5 text-[16px] font-semibold text-white", props.className)} />
    ),
    p: (props) => <p {...props} className={cx("my-3 text-white/90", props.className)} />,
    ul: (props) => (
      <ul {...props} className={cx("my-3 list-disc pl-6 text-white/90", props.className)} />
    ),
    ol: (props) => (
      <ol {...props} className={cx("my-3 list-decimal pl-6 text-white/90", props.className)} />
    ),
    li: (props) => <li {...props} className={cx("my-1.5", props.className)} />,
    blockquote: (props) => (
      <blockquote
        {...props}
        className={cx(
          "my-4 border-l-2 border-white/15 bg-white/[0.03] pl-4 pr-3 py-2 text-white/80",
          props.className,
        )}
      />
    ),
    hr: (props) => <hr {...props} className={cx("my-6 border-white/10", props.className)} />,
    table: (props) => (
      <div className="my-4 overflow-auto rounded-2xl border border-white/10">
        <table
          {...props}
          className={cx("w-full border-collapse text-sm text-white/88", props.className)}
        />
      </div>
    ),
    th: (props) => (
      <th
        {...props}
        className={cx(
          "border-b border-white/10 bg-white/[0.04] px-3 py-2 text-left font-semibold",
          props.className,
        )}
      />
    ),
    td: (props) => (
      <td
        {...props}
        className={cx("border-b border-white/5 px-3 py-2 align-top", props.className)}
      />
    ),
  };

  function MarkdownRenderer({ text }: { text: string }) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    );
  }

  return { default: MarkdownRenderer };
});

function MarkdownOrText({ text, streaming }: { text: string; streaming?: boolean }) {
  const shouldRenderMarkdown = useMemo(() => isProbablyMarkdown(text), [text]);
  const deferredText = useDeferredValue(text);
  const displayText = streaming ? deferredText : text;

  if (!shouldRenderMarkdown) {
    return <>{displayText}</>;
  }

  return (
    <Suspense fallback={<>{displayText}</>}>
      <LazyMarkdown text={displayText} />
    </Suspense>
  );
}

function ProsePanel({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shouldRenderMarkdown = useMemo(() => isProbablyMarkdown(text), [text]);

  useEffect(() => {
    if (!streaming) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [text, streaming, shouldRenderMarkdown]);

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] shadow-[0_20px_80px_rgba(0,0,0,0.34)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)]" />
      <div className="relative px-6 py-6 md:px-8 md:py-7">
        <div className="mb-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-white/42">
          <span>{streaming ? "Live response" : "Result"}</span>
          {streaming && (
            <span className="inline-flex items-center gap-2 text-white/55">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 runtime-pulse-dot" />
              Generating
            </span>
          )}
        </div>
        <div ref={scrollRef} className="max-h-[52vh] overflow-auto pr-1">
          <div
            className={cx(
              "mx-auto max-w-[72ch] text-[15px] leading-8 text-white/90 md:text-[16px]",
              !shouldRenderMarkdown && "whitespace-pre-wrap",
            )}
          >
            <MarkdownOrText text={text} streaming={streaming} />
            {streaming && (
              <span className="ml-1 inline-block h-[1.15em] w-[0.55ch] rounded-sm bg-white/70 align-[-0.08em] runtime-caret" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultPanel({
  label,
  value,
  expanded = false,
  onToggleExpand,
  onRerun,
}: {
  label: string;
  value: unknown;
  expanded?: boolean;
  onToggleExpand?: () => void;
  onRerun?: () => void;
}) {
  const canExpand = Boolean(onToggleExpand);
  const [copied, setCopied] = useState(false);
  const image = useImageObjectUrl(value);

  if (isImageLike(value)) {
    const raw = typeof value === "string" ? value.trim() : "";
    const imgSrc = image.url || raw;
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-6 py-6 shadow-[0_18px_70px_rgba(0,0,0,0.34)]">
        <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em] text-white/42">
          <span>{label}</span>
          {canExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[10px] tracking-[0.12em] text-white/62 transition hover:bg-white/[0.09] hover:text-white/86"
            >
              {expanded ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Expand className="h-3.5 w-3.5" />
              )}
              {expanded ? "Minimize" : "Expand"}
            </button>
          )}
        </div>
        <div className="mt-3 text-[16px] font-medium text-white/92">Your image is ready</div>
        <div
          className={cx(
            // Avoid cropping: let the <img> size itself, only cap max-height.
            "mt-4 rounded-2xl border border-white/10 bg-black/30 p-3",
            expanded ? "max-h-[72vh]" : "max-h-[420px]",
          )}
        >
          <div className="h-full w-full overflow-auto">
            <img
              src={imgSrc}
              alt="Generated image"
              className={cx(
                "mx-auto block w-full object-contain",
                expanded ? "max-h-[68vh]" : "max-h-[392px]",
              )}
              style={{ height: "auto" }}
              onError={(e) => {
                const el = e.currentTarget;
                el.style.display = "none";
              }}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!imgSrc) return;
              window.open(imgSrc, "_blank", "noopener,noreferrer");
            }}
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-sm text-white/85 transition hover:bg-white/[0.09]"
          >
            Open image
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (!imgSrc) return;
              const a = document.createElement("a");
              a.href = imgSrc;
              a.download = `image-${Date.now()}.jpg`;
              a.rel = "noreferrer";
              a.click();
            }}
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-sm text-white/85 transition hover:bg-white/[0.09]"
          >
            Download
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (typeof value === "string") {
    if (isProbablyFileUrl(value) && !isImageLike(value)) {
      return (
        <div
          className={cx(
            "rounded-[28px] border border-white/10 bg-white/[0.03] px-6 py-6 shadow-[0_18px_70px_rgba(0,0,0,0.34)]",
            expanded && "fixed inset-[8vh] z-[10010] overflow-auto rounded-[32px] bg-[#07080b]/98",
          )}
        >
          <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em] text-white/42">
            <span>{label}</span>
            {canExpand && (
              <button
                type="button"
                onClick={onToggleExpand}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[10px] tracking-[0.12em] text-white/62 transition hover:bg-white/[0.09] hover:text-white/86"
              >
                {expanded ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Expand className="h-3.5 w-3.5" />
                )}
                {expanded ? "Minimize" : "Expand"}
              </button>
            )}
          </div>
          <div className="mt-3 text-[16px] font-medium text-white/92">Your file is ready</div>
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-sm text-white/85 transition hover:bg-white/[0.09]"
          >
            Open file
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      );
    }
    return (
      <div
        className={cx(
          expanded && "fixed inset-[8vh] z-[10010] overflow-auto rounded-[32px] bg-[#07080b]/98",
        )}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/42">{label}</div>
          {canExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[10px] tracking-[0.12em] text-white/62 transition hover:bg-white/[0.09] hover:text-white/86"
            >
              {expanded ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Expand className="h-3.5 w-3.5" />
              )}
              {expanded ? "Minimize" : "Expand"}
            </button>
          )}
        </div>
        <ProsePanel text={value} />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void copyText(value).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              });
            }}
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-sm text-white/85 transition hover:bg-white/[0.09]"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
          {onRerun && (
            <button
              type="button"
              onClick={onRerun}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(67,201,255,0.20),rgba(129,101,255,0.14))] px-4 py-2 text-sm text-white transition hover:brightness-110"
            >
              <RefreshCcw className="h-4 w-4" />
              Run again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cx(
        "overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] shadow-[0_18px_70px_rgba(0,0,0,0.34)]",
        expanded && "fixed inset-[8vh] z-[10010] overflow-auto rounded-[32px] bg-[#07080b]/98",
      )}
    >
      <div className="flex items-center justify-between gap-3 px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-white/42">
        <span>{label}</span>
        {canExpand && (
          <button
            type="button"
            onClick={onToggleExpand}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[10px] tracking-[0.12em] text-white/62 transition hover:bg-white/[0.09] hover:text-white/86"
          >
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
            {expanded ? "Minimize" : "Expand"}
          </button>
        )}
      </div>
      <pre
        className={cx(
          "overflow-auto px-5 pb-5 text-[13px] leading-6 text-white/82",
          expanded ? "max-h-[calc(100vh-9rem)]" : "max-h-[54vh]",
        )}
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function ExecutionChrome({
  state,
  onCancel,
  onClose,
}: {
  state: WorkflowRunState;
  onCancel?: () => void;
  onClose?: () => void;
}) {
  const [elapsedTick, setElapsedTick] = useState(0);
  useEffect(() => {
    if (state.status !== "running" && state.status !== "cancelling") return;
    const id = window.setInterval(() => setElapsedTick((t) => t + 1), 500);
    return () => window.clearInterval(id);
  }, [state.status]);

  const model = deriveCustomerRuntimeModel(state);
  if (!model) return null;

  void elapsedTick;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white/62">
        <Clock3 className="h-3.5 w-3.5" />
        {model.elapsedLabel ?? formatRunElapsed(state.startedAt, state.finishedAt)}
      </div>
      <div className="flex items-center gap-2">
        {model.canCancel && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-white/88 transition hover:bg-white/[0.09]"
          >
            {state.status === "cancelling" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <StopCircle className="h-4 w-4" />
            )}
            {state.status === "cancelling" ? "Stopping..." : "Cancel"}
          </button>
        )}
        {model.canClose && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-transparent px-4 py-2.5 text-sm text-white/62 transition hover:border-white/14 hover:text-white/86"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}

function ActionZone({
  state,
  onCancel,
  onClose,
  onRerun,
  embedded,
  showClose = true,
}: {
  state: WorkflowRunState;
  onCancel?: () => void;
  onClose?: () => void;
  onRerun?: () => void;
  embedded?: boolean;
  showClose?: boolean;
}) {
  const model = deriveCustomerRuntimeModel(state);
  const [copied, setCopied] = useState(false);
  if (!model) return null;

  const primaryOutput = model.outputs[0];
  const copyTarget =
    typeof primaryOutput?.value === "string"
      ? primaryOutput.value
      : primaryOutput?.value != null
        ? JSON.stringify(primaryOutput.value, null, 2)
        : model.primaryLiveText?.text;

  return (
    <div className={cx("flex flex-wrap items-center gap-3", embedded ? "pt-1" : "pt-2")}>
      {(state.status === "running" || state.status === "cancelling") && onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-white/84 transition hover:bg-white/[0.09]"
        >
          <StopCircle className="h-4 w-4" />
          {state.status === "cancelling" ? "Stopping..." : "Cancel"}
        </button>
      )}

      {(state.status === "success" || state.status === "error" || state.status === "cancelled") &&
        onRerun && (
          <button
            type="button"
            onClick={onRerun}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(67,201,255,0.20),rgba(129,101,255,0.14))] px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110"
          >
            <RefreshCcw className="h-4 w-4" />
            Run again
          </button>
        )}

      {copyTarget &&
        (state.status === "success" ||
          state.status === "error" ||
          state.status === "cancelled") && (
          <button
            type="button"
            onClick={() => {
              void copyText(copyTarget).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              });
            }}
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-white/82 transition hover:bg-white/[0.09]"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy result"}
          </button>
        )}

      {primaryOutput && (state.status === "success" || state.status === "error") && (
        <button
          type="button"
          onClick={() =>
            downloadValue(
              `${formatOutputLabel(primaryOutput.label).toLowerCase().replace(/\s+/g, "-")}.txt`,
              primaryOutput.value,
            )
          }
          className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-white/82 transition hover:bg-white/[0.09]"
        >
          <Download className="h-4 w-4" />
          Download
        </button>
      )}

      {showClose && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-transparent px-4 py-2.5 text-sm text-white/62 transition hover:border-white/16 hover:text-white/84"
        >
          Close
        </button>
      )}
    </div>
  );
}

function ReadyStateSurface({
  state,
  onSubmitInputs,
  isBuilderTest,
  builderRunLimit,
  requiresApiKeys,
  onBuyWorkflow,
}: {
  state: WorkflowRunState;
  onSubmitInputs?: (values: Record<string, any>) => void;
  isBuilderTest?: boolean;
  builderRunLimit?: BuilderRunLimit;
  requiresApiKeys?: string[];
  onBuyWorkflow?: () => void;
}) {
  const [values, setValues] = useState<Record<string, any>>(() => state.inputValues ?? {});
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [showVaultKeysDialog, setShowVaultKeysDialog] = useState(false);
  const [vaultKeysConfigured, setVaultKeysConfigured] = useState({
    openai: false,
    anthropic: false,
    gemini: false,
  });
  const { getAccessToken } = useAuth();

  const inputs = state.inputs ?? [];
  const showFields = inputs.length > 0;
  const needsApiKey =
    (isBuilderTest &&
      !builderRunLimit?.isAdmin &&
      (builderRunLimit?.used ?? 0) >= (builderRunLimit?.limit ?? 10)) ||
    Boolean(requiresApiKeys?.length);

  const providersRequired = useMemo(() => {
    const set = new Set<"openai" | "anthropic" | "google">();
    const nodes = state.graph?.nodes ?? [];
    if (requiresApiKeys?.length) {
      for (const id of requiresApiKeys) {
        const n = nodes.find((x) => x.id === id);
        const sid = n?.data?.specId ?? "";
        if (isPremiumAiSpec(sid)) set.add(providerForAiSpec(sid, n?.data?.config));
      }
    } else if (isBuilderTest && (builderRunLimit?.used ?? 0) >= (builderRunLimit?.limit ?? 10)) {
      for (const n of nodes) {
        const sid = n.data?.specId ?? "";
        if (isPremiumAiSpec(sid)) set.add(providerForAiSpec(sid, n.data?.config));
      }
    }
    return set;
  }, [state.graph, requiresApiKeys, isBuilderTest, builderRunLimit]);

  const effectiveKeyProviders = useMemo(() => {
    if (needsApiKey && providersRequired.size === 0) {
      return new Set<"openai" | "anthropic" | "google">(["openai"]);
    }
    return providersRequired;
  }, [needsApiKey, providersRequired]);

  useEffect(() => {
    if (!needsApiKey) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/user/api-keys", {
        credentials: "include",
        headers: await bearerAuthHeaders(getAccessToken),
      });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      const next = { openai: false, anthropic: false, gemini: false };
      if (res.ok && data.ok && Array.isArray(data.keys)) {
        for (const k of data.keys) {
          if (k.provider === "openai" && k.configured) next.openai = true;
          else if (k.provider === "anthropic" && k.configured) next.anthropic = true;
          else if (k.provider === "gemini" && k.configured) next.gemini = true;
        }
      }
      setVaultKeysConfigured(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [needsApiKey, getAccessToken]);

  const canSubmit =
    !needsApiKey ||
    ((!effectiveKeyProviders.has("openai") ||
      openaiApiKey.trim().length > 0 ||
      vaultKeysConfigured.openai) &&
      (!effectiveKeyProviders.has("anthropic") ||
        anthropicApiKey.trim().length > 0 ||
        vaultKeysConfigured.anthropic) &&
      (!effectiveKeyProviders.has("google") ||
        geminiApiKey.trim().length > 0 ||
        vaultKeysConfigured.gemini));

  return (
    <div className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(113,207,255,0.08),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.03))] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.34)] md:p-8">
      <div className="mx-auto max-w-[720px]">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/45">
          <Sparkles className="h-3.5 w-3.5" />
          Ready to run
        </div>
        <div className="mt-5 text-[32px] font-medium tracking-[-0.04em] text-white md:text-[42px]">
          {showFields ? "Set up this run" : "Everything is ready"}
        </div>
        <div className="mt-4 max-w-[58ch] text-[15px] leading-7 text-white/64">
          {showFields
            ? "Add the required inputs and start the workflow when you are ready."
            : "This workflow does not need any additional input. Start it whenever you want."}
        </div>

        {isBuilderTest && builderRunLimit && (
          <div className="mt-6 rounded-[22px] border border-white/10 bg-black/25 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-medium text-white/90">Free runs</div>
              {builderRunLimit.isAdmin ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-200">
                  Admin bypass enabled
                </div>
              ) : (
                <div className="text-xs text-white/60">
                  {Math.max(0, builderRunLimit.limit - builderRunLimit.used)} /{" "}
                  {builderRunLimit.limit} remaining
                </div>
              )}
            </div>
            {!builderRunLimit.isAdmin &&
              (builderRunLimit.used ?? 0) >= (builderRunLimit.limit ?? 10) && (
                <div className="mt-2 text-xs leading-6 text-white/55">
                  You’ve hit the free run limit. Add BYOK (Saved keys or paste below) to keep
                  running.
                </div>
              )}
          </div>
        )}

        {(showFields || needsApiKey) && (
          <div className="mt-8 rounded-[28px] border border-white/10 bg-black/25 p-5 md:p-6">
            <div className="space-y-5">
              {showFields &&
                inputs.map((input: WorkflowInput) => (
                  <div key={input.nodeId} className="space-y-2">
                    <div className="text-sm font-medium text-white/90">{input.name}</div>
                    {input.description && (
                      <div className="text-sm leading-6 text-white/52">{input.description}</div>
                    )}
                    <WorkflowInputField
                      input={input}
                      value={values[input.nodeId] ?? input.defaultValue ?? ""}
                      onChange={(value) =>
                        setValues((current) => ({ ...current, [input.nodeId]: value }))
                      }
                    />
                  </div>
                ))}

              {needsApiKey && (
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium text-white/90">Provider keys</div>
                    <button
                      type="button"
                      onClick={() => setShowVaultKeysDialog(true)}
                      className="text-xs font-medium text-cyan-300/90 hover:text-cyan-200 underline underline-offset-2"
                    >
                      Saved keys…
                    </button>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-white/55">
                    {builderRunLimit?.isAdmin
                      ? "Admin bypass is enabled. Add keys only if you want to use your own provider billing."
                      : "Add a key below or use encrypted keys from your account (Saved keys)."}
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <input
                      type="password"
                      value={openaiApiKey}
                      onChange={(event) => setOpenaiApiKey(event.target.value)}
                      placeholder="OpenAI key"
                      className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-cyan-300/30 focus:outline-none"
                    />
                    <input
                      type="password"
                      value={anthropicApiKey}
                      onChange={(event) => setAnthropicApiKey(event.target.value)}
                      placeholder="Anthropic key"
                      className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-cyan-300/30 focus:outline-none"
                    />
                    <input
                      type="password"
                      value={geminiApiKey}
                      onChange={(event) => setGeminiApiKey(event.target.value)}
                      placeholder="Gemini key"
                      className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-cyan-300/30 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!onSubmitInputs || !canSubmit}
            onClick={() => {
              if (!onSubmitInputs) return;
              const payload: Record<string, any> = { ...values };
              if (openaiApiKey.trim()) payload.__openaiApiKey = openaiApiKey.trim();
              if (anthropicApiKey.trim()) payload.__anthropicApiKey = anthropicApiKey.trim();
              if (geminiApiKey.trim()) payload.__geminiApiKey = geminiApiKey.trim();
              onSubmitInputs(payload);
            }}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(67,201,255,0.22),rgba(126,101,255,0.18))] px-5 py-3 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start workflow
            <ArrowRight className="h-4 w-4" />
          </button>

          {onBuyWorkflow && (
            <button
              type="button"
              onClick={onBuyWorkflow}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/72 transition hover:bg-white/[0.08]"
            >
              Get full access
            </button>
          )}
        </div>

        <UserApiKeysDialog
          open={showVaultKeysDialog}
          onClose={() => {
            setShowVaultKeysDialog(false);
            if (!needsApiKey) return;
            void (async () => {
              const res = await fetch("/api/user/api-keys", {
                credentials: "include",
                headers: await bearerAuthHeaders(getAccessToken),
              });
              return res.json();
            })()
              .then((data) => {
                const next = { openai: false, anthropic: false, gemini: false };
                if (data?.ok && Array.isArray(data.keys)) {
                  for (const k of data.keys) {
                    if (k.provider === "openai" && k.configured) next.openai = true;
                    else if (k.provider === "anthropic" && k.configured) next.anthropic = true;
                    else if (k.provider === "gemini" && k.configured) next.gemini = true;
                  }
                }
                setVaultKeysConfigured(next);
              })
              .catch(() => {});
          }}
        />
      </div>
    </div>
  );
}

function ResultsSurface({ state, onRerun }: { state: WorkflowRunState; onRerun?: () => void }) {
  const model = deriveCustomerRuntimeModel(state);
  const [activeIndex, setActiveIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  if (!model) return null;

  const outputs = model.outputs;
  const activeOutput = outputs[Math.min(activeIndex, Math.max(outputs.length - 1, 0))];
  const title =
    model.mode === "partial_results"
      ? "Partial results available"
      : model.mode === "cancelled"
        ? "Run cancelled"
        : model.mode === "failure"
          ? "Run failed"
          : "Results ready";
  const subline =
    model.mode === "failure"
      ? state.error || "The workflow stopped before producing a final result."
      : model.mode === "cancelled"
        ? "The run stopped. Anything already completed is preserved below."
        : state.error || state.summary || undefined;
  const singleOutput = outputs.length <= 1;

  const chrome = (
    <div className="space-y-5">
      <div className="text-center">
        <div className="text-[34px] font-medium tracking-[-0.04em] text-white md:text-[46px]">
          {title}
        </div>
        {subline && (
          <div className="mx-auto mt-4 max-w-[56ch] text-[15px] leading-7 text-white/62">
            {subline}
          </div>
        )}
      </div>

      {outputs.length > 1 && (
        <div className="md:hidden">
          <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-2">
            <div className="mb-1 px-3 pt-1.5 text-[11px] uppercase tracking-[0.18em] text-white/42">
              Outputs
            </div>
            <div className="flex gap-2 overflow-auto px-2 pb-2 scrollbar-hide">
              {outputs.map((output, index) => (
                <button
                  key={`${output.nodeId}-${index}`}
                  type="button"
                  onClick={() => {
                    setActiveIndex(index);
                    setExpanded(false);
                  }}
                  className={cx(
                    "shrink-0 rounded-full border px-3 py-2 text-left text-sm transition",
                    index === activeIndex
                      ? "border-cyan-300/25 bg-[linear-gradient(135deg,rgba(77,208,255,0.18),rgba(233,77,255,0.10))] text-white"
                      : "border-white/10 bg-white/[0.02] text-white/65 hover:bg-white/[0.05]",
                  )}
                >
                  <span className="mr-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
                    {index + 1}
                  </span>
                  <span className="max-w-[32ch] truncate align-middle">
                    {formatOutputLabel(output.label)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div
        className={cx(
          "gap-4",
          singleOutput ? "space-y-4" : "grid md:grid-cols-[240px_minmax(0,1fr)]",
        )}
      >
        {outputs.length > 1 && (
          <div className="hidden rounded-[26px] border border-white/10 bg-white/[0.03] p-3 md:block">
            <div className="mb-2 px-3 pt-2 text-[11px] uppercase tracking-[0.18em] text-white/42">
              Outputs
            </div>
            <div className="space-y-2">
              {outputs.map((output, index) => (
                <button
                  key={`${output.nodeId}-${index}`}
                  type="button"
                  onClick={() => {
                    setActiveIndex(index);
                    setExpanded(false);
                  }}
                  className={cx(
                    "w-full rounded-[18px] border px-3 py-3 text-left transition",
                    index === activeIndex
                      ? "border-cyan-300/25 bg-[linear-gradient(135deg,rgba(77,208,255,0.18),rgba(233,77,255,0.10))] text-white"
                      : "border-white/8 bg-white/[0.02] text-white/62 hover:bg-white/[0.05]",
                  )}
                >
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                    Output {index + 1}
                  </div>
                  <div className="mt-1 truncate text-sm">{formatOutputLabel(output.label)}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={cx("space-y-4", singleOutput && "mx-auto w-full max-w-[1100px]")}>
          {activeOutput ? (
            <ResultPanel
              label={formatOutputLabel(activeOutput.label)}
              value={activeOutput.value}
              expanded={expanded}
              onToggleExpand={() => setExpanded((value) => !value)}
              onRerun={onRerun}
            />
          ) : model.hasUsefulPartialOutput && model.primaryLiveText?.text ? (
            <ProsePanel text={model.primaryLiveText.text} />
          ) : (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-6 py-10 text-center text-white/62">
              <div className="text-[16px] font-medium text-white/86">
                Workflow executed successfully
              </div>
              <div className="mt-2 text-sm leading-6 text-white/58">
                This workflow did not produce any outputs.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {!expanded ? (
        chrome
      ) : (
        <>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="fixed inset-0 z-[10005] bg-black/75 backdrop-blur-sm"
            aria-label="Close expanded output"
          />
          <div className="fixed inset-0 z-[10010] overflow-auto px-4 py-6 md:px-8 md:py-10">
            <div className="mx-auto w-full max-w-[1260px]">{chrome}</div>
          </div>
        </>
      )}
    </>
  );
}

export default function CustomerWorkflowRuntimeSurface({
  state,
  onCancel,
  onClose,
  onRerun,
  onSubmitInputs,
  embedded = false,
  hideHeader = false,
  hideActionZone = false,
  isBuilderTest,
  builderRunLimit,
  requiresApiKeys,
  onBuyWorkflow,
}: CustomerWorkflowRuntimeSurfaceProps) {
  const model = deriveCustomerRuntimeModel(state);

  if (!state || !model) {
    return (
      <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.34)] md:p-8">
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes runtimeAmbientFlow { 0%,100% { transform: translate3d(0,0,0) scale(1); opacity: .65; } 50% { transform: translate3d(0,-6px,0) scale(1.02); opacity: .95; } }
              @keyframes runtimePulseDot { 0%,100% { opacity: .45; transform: scale(.92); } 50% { opacity: 1; transform: scale(1.02); } }
              @keyframes runtimeCaret { 0%,49% { opacity: 1; } 50%,100% { opacity: .08; } }
              @keyframes runtimeActiveSheen { 0% { transform: translateX(-20%); opacity: .2; } 50% { opacity: .6; } 100% { transform: translateX(20%); opacity: .24; } }
              .runtime-ambient-flow { animation: runtimeAmbientFlow 7s ease-in-out infinite; }
              .runtime-pulse-dot { animation: runtimePulseDot 1.8s ease-in-out infinite; }
              .runtime-caret { animation: runtimeCaret 1.15s step-end infinite; }
              .runtime-active-sheen { animation: runtimeActiveSheen 4.5s ease-in-out infinite; }
              @media (prefers-reduced-motion: reduce) {
                .runtime-ambient-flow, .runtime-pulse-dot, .runtime-caret, .runtime-active-sheen { animation: none !important; }
              }
            `,
          }}
        />
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-center">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(89,198,255,0.18),transparent_70%)] runtime-ambient-flow" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/12 bg-white/[0.04]">
              <Loader2 className="h-7 w-7 animate-spin text-white/78" />
            </div>
          </div>
          <div className="text-[28px] font-medium tracking-[-0.03em] text-white">
            Preparing your runtime
          </div>
          <div className="max-w-md text-[15px] leading-7 text-white/58">
            Setting up the live session and syncing the workflow state.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes runtimeAmbientFlow { 0%,100% { transform: translate3d(0,0,0) scale(1); opacity: .65; } 50% { transform: translate3d(0,-6px,0) scale(1.02); opacity: .95; } }
            @keyframes runtimePulseDot { 0%,100% { opacity: .45; transform: scale(.92); } 50% { opacity: 1; transform: scale(1.02); } }
            @keyframes runtimeCaret { 0%,49% { opacity: 1; } 50%,100% { opacity: .08; } }
            @keyframes runtimeActiveSheen { 0% { transform: translateX(-20%); opacity: .2; } 50% { opacity: .6; } 100% { transform: translateX(20%); opacity: .24; } }
            @keyframes runtimeStageGlaze { 0% { background-position: -220% 0%, -140% 0%, 0 0; } 100% { background-position: 220% 0%, 140% 0%, 0 0; } }
            @keyframes runtimeStageOrb { 0%,100% { transform: scale(1); opacity: .26; } 50% { transform: scale(1.03); opacity: .42; } }
            .runtime-ambient-flow { animation: runtimeAmbientFlow 7s ease-in-out infinite; }
            .runtime-pulse-dot { animation: runtimePulseDot 1.8s ease-in-out infinite; }
            .runtime-caret { animation: runtimeCaret 1.15s step-end infinite; }
            .runtime-active-sheen { animation: runtimeActiveSheen 4.5s ease-in-out infinite; }
            .runtime-stage-glaze { animation: runtimeStageGlaze 1.7s linear infinite; }
            .runtime-stage-orb { animation: runtimeStageOrb 2s ease-in-out infinite; }
            @media (prefers-reduced-motion: reduce) {
              .runtime-ambient-flow, .runtime-pulse-dot, .runtime-caret, .runtime-active-sheen, .runtime-stage-glaze, .runtime-stage-orb { animation: none !important; }
            }
          `,
        }}
      />

      {!hideHeader && <ExecutionChrome state={state} onCancel={onCancel} onClose={onClose} />}

      {state.phase === "input" && state.status === "idle" ? (
        <ReadyStateSurface
          state={state}
          onSubmitInputs={onSubmitInputs}
          isBuilderTest={isBuilderTest}
          builderRunLimit={builderRunLimit}
          requiresApiKeys={requiresApiKeys}
          onBuyWorkflow={onBuyWorkflow}
        />
      ) : state.status === "success" || state.status === "error" || state.status === "cancelled" ? (
        <>
          {hideHeader && <ExecutionChrome state={state} onCancel={onCancel} onClose={onClose} />}
          <ResultsSurface key={state.runId} state={state} onRerun={onRerun} />
          {!hideActionZone && (
            <ActionZone
              state={state}
              onCancel={onCancel}
              onClose={onClose}
              onRerun={onRerun}
              embedded={embedded}
              showClose={hideHeader}
            />
          )}
        </>
      ) : (
        <>
          {hideHeader && <ExecutionChrome state={state} onCancel={onCancel} onClose={onClose} />}
          <div className="space-y-5">
            <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(72,214,255,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,76,198,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.012))] shadow-[0_28px_90px_rgba(0,0,0,0.38)]">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(0,190,255,0.10),transparent_35%,rgba(255,0,153,0.10))] runtime-ambient-flow" />
              <div className="relative px-6 py-8 md:px-10">
                <div className="mx-auto flex w-full max-w-[900px] flex-col items-center justify-center gap-5 text-center">
                  <div className="max-w-[720px]">
                    <div className="text-[34px] font-medium tracking-[-0.04em] text-white md:text-[52px]">
                      {model.headline}
                    </div>
                    {model.subline && (
                      <div className="mx-auto mt-5 max-w-[58ch] text-[15px] leading-7 text-white/62 md:text-[16px]">
                        {model.subline}
                      </div>
                    )}
                  </div>

                  {state.connectionState === "reconnecting" && (
                    <div className="text-sm text-white/48">Reconnecting to live updates...</div>
                  )}
                </div>
              </div>
            </div>

            {model.mode === "streaming" && model.primaryLiveText?.text ? (
              <ProsePanel text={model.primaryLiveText.text} streaming />
            ) : null}

            <CustomerLiveExecutionPanel state={state} isStopping={model.mode === "stopping"} />
          </div>
        </>
      )}
    </div>
  );
}

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
import CustomerRunNodeStage from "./CustomerRunNodeStage";
import { UserApiKeysDialog } from "../../settings/UserApiKeysDialog";
import { bearerAuthHeaders } from "../../../lib/auth/bearer-headers";
import { useAuth } from "../../auth/AuthContext";
import type { Components } from "react-markdown";

import { normalizeWorkflowMarkdown } from "../../../lib/markdown/normalize-workflow-markdown";
import {
  downloadWorkflowImageFromUrl,
  isWorkflowImageOutputUrl,
} from "../../../lib/workflow/client-image-download";

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
  onSubmitInputs?: (values: Record<string, unknown>) => void;
  embedded?: boolean;
  hideHeader?: boolean;
  hideActionZone?: boolean;
  /** Elapsed timer in execution chrome; intended for admin diagnostics only. */
  showExecutionTimer?: boolean;
  isBuilderTest?: boolean;
  builderRunLimit?: BuilderRunLimit;
  requiresApiKeys?: string[];
  onBuyWorkflow?: () => void;
  /** When false, parent (e.g. modal header) owns the Cancel control during execution. Default true. */
  showInlineExecutionCancel?: boolean;
  /** When false, no ExecutionChrome rows are rendered (parent supplies header). Default true. */
  renderExecutionChrome?: boolean;
};

function useNarrowViewport() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return narrow;
}

function isImageLike(value: unknown): boolean {
  return typeof value === "string" && isWorkflowImageOutputUrl(value);
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
  if (/(^|\n)\|(.+\|)+\s*(\n\|[-:\s|]+\|)/.test(t)) return true; // GFM table with separator
  if (/(^|\n)[^|\n]+\|[^|\n]+(\n[^|\n]+\|[^|\n]+)+/.test(t)) return true; // loose pipe rows (model output)
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
    const normalized = normalizeWorkflowMarkdown(text);
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {normalized}
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

function ProsePanel({
  text,
  streaming = false,
  lockStreamScroll = false,
}: {
  text: string;
  streaming?: boolean;
  /** When streaming on small viewports, clip latest output instead of scrolling. */
  lockStreamScroll?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shouldRenderMarkdown = useMemo(() => isProbablyMarkdown(text), [text]);
  const streamClip = Boolean(streaming && lockStreamScroll);

  useEffect(() => {
    if (!streaming || streamClip) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [text, streaming, streamClip, shouldRenderMarkdown]);

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] shadow-[0_20px_80px_rgba(0,0,0,0.34)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)]" />
      <div className="relative px-4 py-4 max-md:px-4 max-md:py-4 md:px-8 md:py-7">
        <div
          className={cx(
            "mb-3 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-white/42 md:mb-4",
            streaming && "justify-center",
          )}
        >
          <span>{streaming ? "Live response" : "Result"}</span>
          {streaming && (
            <span className="inline-flex items-center gap-2 text-white/55">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 runtime-pulse-dot" />
              Generating
            </span>
          )}
        </div>
        <div
          ref={scrollRef}
          className={cx(
            "min-h-0",
            streamClip
              ? "flex max-h-[min(28vh,200px)] flex-col justify-end overflow-hidden md:max-h-[52vh] md:justify-start md:overflow-auto md:pr-1"
              : "max-h-[52vh] overflow-auto pr-1",
          )}
        >
          <div
            className={cx(
              "max-w-[72ch] text-left text-[15px] leading-7 text-white/90 md:text-[16px] md:leading-8",
              !streaming && "mx-auto",
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
  const [imageDownloadBusy, setImageDownloadBusy] = useState(false);
  const [imageDownloadError, setImageDownloadError] = useState(false);
  const [auxFileDownloadBusy, setAuxFileDownloadBusy] = useState(false);

  if (isImageLike(value)) {
    const imgSrc = typeof value === "string" ? value.trim() : "";
    return (
      <div
        className={cx(
          "rounded-[28px] border border-white/10 bg-white/[0.03] px-6 py-6 shadow-[0_18px_70px_rgba(0,0,0,0.34)]",
          expanded && "flex min-h-0 flex-1 flex-col",
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
        <div className="mt-3 text-[16px] font-medium text-white/92">Your image is ready</div>
        <div
          className={cx(
            "mt-4 flex min-h-0 justify-center rounded-2xl border border-white/10 bg-black/30 p-3",
            expanded ? "min-h-0 flex-1 items-center py-4 sm:py-6" : "max-h-[420px]",
          )}
        >
          <div
            className={cx(
              "w-full overflow-auto",
              expanded && "flex max-h-[min(80dvh,900px)] items-center justify-center",
            )}
          >
            <img
              src={imgSrc}
              alt="Generated image"
              className={cx(
                "mx-auto block object-contain",
                expanded
                  ? "h-auto max-h-[min(80dvh,860px)] w-auto max-w-full"
                  : "max-h-[392px] w-full",
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
          {imageDownloadError && (
            <span className="text-xs text-rose-300/90">
              Couldn&apos;t download. Try expanding and saving from your browser.
            </span>
          )}
          <button
            type="button"
            disabled={!imgSrc || imageDownloadBusy}
            onClick={() => {
              if (!imgSrc || imageDownloadBusy) return;
              setImageDownloadError(false);
              setImageDownloadBusy(true);
              void (async () => {
                await new Promise<void>((r) => requestAnimationFrame(() => r()));
                try {
                  await downloadWorkflowImageFromUrl(imgSrc);
                } catch {
                  setImageDownloadError(true);
                } finally {
                  setImageDownloadBusy(false);
                }
              })();
            }}
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-sm text-white/85 transition hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {imageDownloadBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {imageDownloadBusy ? "Downloading…" : "Download"}
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
          <button
            type="button"
            disabled={auxFileDownloadBusy}
            onClick={() => {
              if (auxFileDownloadBusy) return;
              setAuxFileDownloadBusy(true);
              void (async () => {
                await new Promise<void>((r) => requestAnimationFrame(() => r()));
                try {
                  downloadValue(`workflow-output-${Date.now()}.txt`, value);
                } finally {
                  setAuxFileDownloadBusy(false);
                }
              })();
            }}
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-sm text-white/85 transition hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {auxFileDownloadBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {auxFileDownloadBusy ? "Downloading…" : "Download"}
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
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-white/42">
        <span>{label}</span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={auxFileDownloadBusy}
            onClick={() => {
              if (auxFileDownloadBusy) return;
              setAuxFileDownloadBusy(true);
              void (async () => {
                await new Promise<void>((r) => requestAnimationFrame(() => r()));
                try {
                  downloadValue(`workflow-output-${Date.now()}.json`, value);
                } finally {
                  setAuxFileDownloadBusy(false);
                }
              })();
            }}
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-[10px] font-medium tracking-[0.12em] text-white/72 transition hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {auxFileDownloadBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {auxFileDownloadBusy ? "Saving…" : "Download"}
          </button>
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
  showTimer = false,
  showCancel = true,
}: {
  state: WorkflowRunState;
  onCancel?: () => void;
  onClose?: () => void;
  showTimer?: boolean;
  showCancel?: boolean;
}) {
  const [elapsedTick, setElapsedTick] = useState(0);
  useEffect(() => {
    if (!showTimer) return;
    if (state.status !== "running" && state.status !== "cancelling") return;
    const id = window.setInterval(() => setElapsedTick((t) => t + 1), 500);
    return () => window.clearInterval(id);
  }, [state.status, showTimer]);

  const model = deriveCustomerRuntimeModel(state);
  if (!model) return null;

  void elapsedTick;

  const showCancelBtn = showCancel && model.canCancel && onCancel;
  const showClose = model.canClose && onClose;
  if (!showTimer && !showCancelBtn && !showClose) return null;

  return (
    <div className={cx("flex items-center gap-3", showTimer ? "justify-between" : "justify-end")}>
      {showTimer && (
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white/62">
          <Clock3 className="h-3.5 w-3.5" />
          {model.elapsedLabel ?? formatRunElapsed(state.startedAt, state.finishedAt)}
        </div>
      )}
      <div className="flex items-center gap-2">
        {showCancelBtn && (
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
        {showClose && (
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
  showCancel = true,
}: {
  state: WorkflowRunState;
  onCancel?: () => void;
  onClose?: () => void;
  onRerun?: () => void;
  embedded?: boolean;
  showClose?: boolean;
  showCancel?: boolean;
}) {
  const model = deriveCustomerRuntimeModel(state);
  const [copied, setCopied] = useState(false);
  if (!model) return null;

  const primaryOutput = model.outputs[0];
  const primaryOutputExists = primaryOutput != null;
  const primaryOutputIsInlineText =
    typeof primaryOutput?.value === "string" &&
    !isImageLike(primaryOutput.value) &&
    !isProbablyFileUrl(primaryOutput.value);
  const copyTarget =
    typeof primaryOutput?.value === "string"
      ? primaryOutput.value
      : primaryOutput?.value != null
        ? JSON.stringify(primaryOutput.value, null, 2)
        : model.primaryLiveText?.text;

  return (
    <div className={cx("flex flex-wrap items-center gap-3", embedded ? "pt-1" : "pt-2")}>
      {showCancel && (state.status === "running" || state.status === "cancelling") && onCancel && (
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
        onRerun &&
        !primaryOutputIsInlineText && (
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
        !primaryOutputExists &&
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
  onSubmitInputs?: (values: Record<string, unknown>) => void;
  isBuilderTest?: boolean;
  builderRunLimit?: BuilderRunLimit;
  requiresApiKeys?: string[];
  onBuyWorkflow?: () => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() => state.inputValues ?? {});
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
              const payload: Record<string, unknown> = { ...values };
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
    <div className={cx(expanded ? "flex min-h-[min(88dvh,920px)] flex-col gap-5" : "space-y-5")}>
      <div className={cx("text-center", expanded && "shrink-0")}>
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
        <div className={cx("md:hidden", expanded && "shrink-0")}>
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
          expanded && "min-h-0 flex-1 flex-col md:min-h-0",
          expanded && !singleOutput && "md:items-stretch",
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

        <div
          className={cx(
            "space-y-4",
            singleOutput && "mx-auto w-full max-w-[1100px]",
            expanded && "flex min-h-0 flex-1 flex-col",
          )}
        >
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
          ) : model.mode === "failure" ? (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-6 py-10 text-center text-white/62">
              <div className="text-[16px] font-medium text-white/86">No result to show</div>
              <div className="mt-2 text-sm leading-6 text-white/58">
                The run did not complete successfully, so there is no output to display here.
              </div>
            </div>
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
          <div className="fixed inset-0 z-[10010] overflow-auto px-3 py-5 sm:px-5 sm:py-7 md:px-10 md:py-10">
            <div className="mx-auto w-full max-w-[min(96vw,1420px)]">{chrome}</div>
          </div>
        </>
      )}
    </>
  );
}

function RuntimePhaseAnimation({ variant }: { variant: "connecting" | "finalizing" }) {
  const title = variant === "connecting" ? "Establishing live link" : "Assembling final output";
  const subtitle =
    variant === "connecting"
      ? "Opening the execution stream and syncing the first live snapshot."
      : "The run is complete. Packaging the final state before showing results.";
  const eyebrow = variant === "connecting" ? "Connecting" : "Finalizing";

  return (
    <div className="relative w-full max-w-[940px] py-2 md:py-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(109,233,255,0.12),transparent_42%),radial-gradient(circle_at_72%_30%,rgba(255,101,194,0.11),transparent_28%)] runtime-ambient-flow" />
      <div className="relative flex flex-col items-center gap-4 md:gap-8">
        <div className="relative flex h-[130px] w-full items-center justify-center overflow-hidden md:h-[220px]">
          <div className="absolute inset-x-[16%] top-1/2 h-px -translate-y-1/2 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.10),rgba(255,255,255,0.32),rgba(255,255,255,0.10),transparent)]" />
          <div className="absolute inset-x-[22%] top-1/2 h-[72px] -translate-y-1/2 rounded-full border border-white/6 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05),transparent_70%)] backdrop-blur-[2px]" />
          <div className="absolute h-[100px] w-[100px] rounded-full border border-cyan-300/12 runtime-signal-rotate md:h-[176px] md:w-[176px]" />
          <div className="absolute h-[72px] w-[72px] rounded-full border border-fuchsia-300/12 [animation-direction:reverse] runtime-signal-rotate md:h-[122px] md:w-[122px]" />
          <div className="absolute h-[44px] w-[44px] rounded-full border border-white/12 bg-white/[0.035] runtime-signal-core md:h-[74px] md:w-[74px]" />
          <div className="absolute h-[150px] w-[150px] rounded-full border border-cyan-200/8 runtime-signal-wave md:h-[240px] md:w-[240px]" />
          <div className="absolute h-[150px] w-[150px] rounded-full border border-fuchsia-200/8 [animation-delay:1.05s] runtime-signal-wave md:h-[240px] md:w-[240px]" />
          <div className="absolute h-2.5 w-2.5 rounded-full bg-cyan-300/95 shadow-[0_0_24px_rgba(103,232,249,0.7)] runtime-signal-orb" />
          <div className="absolute top-[28%] h-10 w-px bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,0.18),rgba(255,255,255,0))] runtime-signal-steam-1" />
          <div className="absolute top-[24%] h-14 w-px bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,0.12),rgba(255,255,255,0))] runtime-signal-steam-2" />
          <div className="absolute top-[30%] h-8 w-px bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,0.14),rgba(255,255,255,0))] runtime-signal-steam-3" />
          <div className="absolute bottom-[26%] flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-white/34">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 runtime-pulse-dot" />
            {eyebrow}
          </div>
        </div>
        <div className="max-w-[48ch] space-y-1.5 text-center md:space-y-2">
          <div className="text-[17px] font-medium tracking-[-0.03em] text-white/92 md:text-[28px]">
            {title}
          </div>
          <div className="text-[12px] leading-6 text-white/56 md:text-[15px] md:leading-7">
            {subtitle}
          </div>
        </div>
      </div>
    </div>
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
  showExecutionTimer = false,
  isBuilderTest,
  builderRunLimit,
  requiresApiKeys,
  onBuyWorkflow,
  showInlineExecutionCancel = true,
  renderExecutionChrome = true,
}: CustomerWorkflowRuntimeSurfaceProps) {
  const model = deriveCustomerRuntimeModel(state);
  const narrow = useNarrowViewport();
  /** Parent shell (e.g. Premium modal) already provides a topbar close — avoid duplicating it here. */
  const executionChromeOnClose = hideHeader ? undefined : onClose;

  if (!state || !model) {
    return null;
  }

  return (
    <div
      className={cx(
        "min-h-0",
        state.phase === "executing" && (state.status === "running" || state.status === "cancelling")
          ? "flex h-full min-h-0 flex-col space-y-3 md:space-y-4"
          : "space-y-4 md:space-y-5",
      )}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes runtimeAmbientFlow { 0%,100% { transform: translate3d(0,0,0) scale(1); opacity: .65; } 50% { transform: translate3d(0,-6px,0) scale(1.02); opacity: .95; } }
            @keyframes runtimePulseDot { 0%,100% { opacity: .45; transform: scale(.92); } 50% { opacity: 1; transform: scale(1.02); } }
            @keyframes runtimeCaret { 0%,49% { opacity: 1; } 50%,100% { opacity: .08; } }
            @keyframes runtimeActiveSheen { 0% { transform: translateX(-20%); opacity: .2; } 50% { opacity: .6; } 100% { transform: translateX(20%); opacity: .24; } }
            @keyframes runtimeStageGlaze { 0% { background-position: -220% 0%, -140% 0%, 0 0; } 100% { background-position: 220% 0%, 140% 0%, 0 0; } }
            @keyframes runtimeStageOrb { 0%,100% { transform: scale(1); opacity: .26; } 50% { transform: scale(1.03); opacity: .42; } }
            @keyframes runtimeSignalRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes runtimeSignalWave { 0% { transform: scale(.35); opacity: 0; } 28% { opacity: .42; } 100% { transform: scale(1); opacity: 0; } }
            @keyframes runtimeSignalCore { 0%,100% { transform: scale(.94); box-shadow: 0 0 0 rgba(255,255,255,0.08); } 50% { transform: scale(1.03); box-shadow: 0 0 36px rgba(120,220,255,0.18); } }
            @keyframes runtimeSignalOrb { 0% { transform: rotate(0deg) translateX(75px) rotate(0deg); } 100% { transform: rotate(360deg) translateX(75px) rotate(-360deg); } }
            @keyframes runtimeSignalSteam1 { 0%,100% { transform: translate3d(-18px,14px,0) scaleY(.82); opacity: 0; } 25% { opacity: .16; } 55% { opacity: .34; } 100% { transform: translate3d(-10px,-18px,0) scaleY(1.08); opacity: 0; } }
            @keyframes runtimeSignalSteam2 { 0%,100% { transform: translate3d(0,18px,0) scaleY(.78); opacity: 0; } 30% { opacity: .12; } 60% { opacity: .28; } 100% { transform: translate3d(0,-22px,0) scaleY(1.16); opacity: 0; } }
            @keyframes runtimeSignalSteam3 { 0%,100% { transform: translate3d(18px,12px,0) scaleY(.86); opacity: 0; } 25% { opacity: .15; } 58% { opacity: .3; } 100% { transform: translate3d(10px,-16px,0) scaleY(1.04); opacity: 0; } }
            .runtime-ambient-flow { animation: runtimeAmbientFlow 7s ease-in-out infinite; }
            .runtime-pulse-dot { animation: runtimePulseDot 1.8s ease-in-out infinite; }
            .runtime-caret { animation: runtimeCaret 1.15s step-end infinite; }
            .runtime-active-sheen { animation: runtimeActiveSheen 4.5s ease-in-out infinite; }
            .runtime-stage-glaze { animation: runtimeStageGlaze 1.7s linear infinite; }
            .runtime-stage-orb { animation: runtimeStageOrb 2s ease-in-out infinite; }
            .runtime-signal-rotate { animation: runtimeSignalRotate 8s linear infinite; }
            .runtime-signal-wave { animation: runtimeSignalWave 2.2s ease-out infinite; }
            .runtime-signal-core { animation: runtimeSignalCore 2.4s ease-in-out infinite; }
            .runtime-signal-orb { animation: runtimeSignalOrb 2.8s linear infinite; }
            .runtime-signal-steam-1 { animation: runtimeSignalSteam1 2.9s ease-in-out infinite; }
            .runtime-signal-steam-2 { animation: runtimeSignalSteam2 3.2s ease-in-out infinite .22s; }
            .runtime-signal-steam-3 { animation: runtimeSignalSteam3 2.8s ease-in-out infinite .44s; }
            @media (prefers-reduced-motion: reduce) {
              .runtime-ambient-flow, .runtime-pulse-dot, .runtime-caret, .runtime-active-sheen, .runtime-stage-glaze, .runtime-stage-orb, .runtime-signal-rotate, .runtime-signal-wave, .runtime-signal-core, .runtime-signal-orb, .runtime-signal-steam-1, .runtime-signal-steam-2, .runtime-signal-steam-3 { animation: none !important; }
            }
          `,
        }}
      />

      {!hideHeader && renderExecutionChrome && (
        <ExecutionChrome
          state={state}
          onCancel={onCancel}
          onClose={executionChromeOnClose}
          showTimer={showExecutionTimer}
          showCancel={showInlineExecutionCancel}
        />
      )}

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
          {hideHeader && renderExecutionChrome && (
            <ExecutionChrome
              state={state}
              onCancel={onCancel}
              onClose={executionChromeOnClose}
              showTimer={showExecutionTimer}
              showCancel={showInlineExecutionCancel}
            />
          )}
          <ResultsSurface key={state.runId} state={state} onRerun={onRerun} />
          {!hideActionZone && (
            <ActionZone
              state={state}
              onCancel={onCancel}
              onClose={onClose}
              onRerun={onRerun}
              embedded={embedded}
              showClose={hideHeader}
              showCancel={showInlineExecutionCancel}
            />
          )}
        </>
      ) : (
        <>
          {hideHeader && renderExecutionChrome && (
            <ExecutionChrome
              state={state}
              onCancel={onCancel}
              onClose={executionChromeOnClose}
              showTimer={showExecutionTimer}
              showCancel={showInlineExecutionCancel}
            />
          )}
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(72,214,255,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,76,198,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.012))] shadow-[0_28px_90px_rgba(0,0,0,0.38)]">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(0,190,255,0.10),transparent_35%,rgba(255,0,153,0.10))] runtime-ambient-flow" />
            <div className="relative flex h-full min-h-0 flex-1 flex-col justify-center px-4 py-4 md:min-h-[560px] md:px-10 md:py-8">
              <div className="mx-auto flex w-full min-h-0 max-w-[980px] flex-col items-center justify-center gap-4 text-center md:gap-8">
                <div className="max-w-[720px] max-md:shrink-0">
                  <div className="text-[22px] font-medium tracking-[-0.04em] text-white md:text-[52px]">
                    {model.headline}
                  </div>
                  {model.subline && (
                    <div className="mx-auto mt-2 max-w-[58ch] text-[13px] leading-6 text-white/62 md:mt-5 md:text-[16px] md:leading-7">
                      {model.subline}
                    </div>
                  )}
                </div>

                {model.mode === "streaming" && model.primaryLiveText?.text ? (
                  <div className="w-full max-w-[860px] max-md:min-h-0 max-md:flex-1 max-md:flex max-md:flex-col">
                    <ProsePanel
                      text={model.primaryLiveText.text}
                      streaming
                      lockStreamScroll={narrow}
                    />
                  </div>
                ) : model.mode === "queueing" && model.activeNodeIds.length === 0 ? (
                  <RuntimePhaseAnimation variant="connecting" />
                ) : model.mode === "finalizing" ? (
                  <RuntimePhaseAnimation variant="finalizing" />
                ) : (model.mode === "node" || model.mode === "queueing") &&
                  model.activeNodeIds.length > 0 ? (
                  <div className="w-full max-w-[900px] max-md:shrink-0">
                    <CustomerRunNodeStage graph={state.graph} activeNodeIds={model.activeNodeIds} />
                  </div>
                ) : model.mode === "stopping" ? (
                  <div className="flex h-[120px] items-center justify-center md:h-[220px]">
                    <div className="inline-flex items-center gap-3 rounded-full border border-white/12 bg-white/[0.05] px-5 py-3 text-sm text-white/82">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Stopping current execution...
                    </div>
                  </div>
                ) : (
                  <div className="w-full max-w-[900px] max-md:shrink-0">
                    <CustomerRunNodeStage graph={state.graph} activeNodeIds={model.activeNodeIds} />
                  </div>
                )}

                {model.mode === "node" && model.activeNodeIds.length > 1 && (
                  <div className="text-xs text-white/52 md:text-sm">
                    {model.activeNodeIds.length > 3
                      ? `Showing 3 active nodes. +${model.activeNodeIds.length - 3} more running.`
                      : `${model.activeNodeIds.length} nodes are running.`}
                  </div>
                )}

                {state.connectionState === "reconnecting" && (
                  <div className="text-xs text-white/48 md:text-sm">
                    Reconnecting to live updates...
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

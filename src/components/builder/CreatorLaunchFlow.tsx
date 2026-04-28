"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  Wand2,
  X,
} from "lucide-react";
import Image from "next/image";
import { extractWorkflowInputs } from "@/lib/workflow/input-extraction";
import type { WorkflowInput } from "@/lib/workflow/run-types";
import type { WorkflowRunState } from "./PremiumWorkflowRunModal";
import { useAuth } from "src/components/auth/AuthContext";

type LaunchIntent = "image" | "writing" | "custom";
type LaunchStep = "auth" | "intent" | "draft" | "preview" | "inputs" | "position" | "share";

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
  { key: "auth", label: "Sign in" },
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
        "group min-h-[128px] rounded-[22px] border p-5 text-left transition-colors duration-200",
        "bg-white/[0.04] hover:bg-white/[0.055]",
        active
          ? "border-cyan-200/45 shadow-[0_18px_70px_rgba(34,211,238,0.16),inset_0_1px_0_rgba(255,255,255,0.08)]"
          : "border-white/10 hover:border-white/16",
      )}
    >
      <div
        className={cx(
          "mb-4 inline-flex text-white/68 transition-colors duration-200 group-hover:text-cyan-100",
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

function PremiumBlackBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute inset-0 bg-black" />
    </div>
  );
}

function GlowBehindFooterCTA() {
  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[18px]"
      aria-hidden
    >
      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute -inset-10 opacity-80 blur-2xl edge-grad-animated" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/25 to-black/65" />
    </div>
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

function IntentRow({
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
        "w-full text-left rounded-2xl px-4 py-4 transition-colors",
        "border border-white/10 bg-transparent hover:bg-white/[0.03]",
        active && "border-white/20 bg-white/[0.03]",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-white/70">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[15px] font-semibold text-white">{title}</div>
            <ArrowRight className="h-4 w-4 text-white/35" />
          </div>
          <div className="mt-1 text-sm leading-5 text-white/50">{description}</div>
        </div>
      </div>
    </button>
  );
}

type AuthMode = "signin" | "signup" | "forgot" | "verify";

function EmbeddedSignIn() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPasswordForEmail } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  const handleGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      setError(e?.message || "Could not start Google sign-in.");
      setBusy(false);
    }
  };

  const handleSignin = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (e: any) {
      setError(e?.message || "Sign in failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignup = async () => {
    setBusy(true);
    setError(null);
    try {
      if (password.length < 8) throw new Error("Password must be at least 8 characters.");
      if (password !== confirm) throw new Error("Passwords do not match.");
      await signUpWithEmail({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        handle: (email.split("@")[0] ?? "user").trim(),
      });
      setMode("verify");
    } catch (e: any) {
      setError(e?.message || "Sign up failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async () => {
    setBusy(true);
    setError(null);
    try {
      await resetPasswordForEmail(email.trim());
      setForgotSent(true);
    } catch (e: any) {
      setError(e?.message || "Could not send reset email.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-6 sm:pt-10">
      <div className="mx-auto w-full max-w-[520px]">
        <div className="text-xs font-semibold tracking-wide text-white/60">
          Welcome to the world of Edgaze
        </div>
        <h2 className="mt-2 text-[22px] font-semibold text-white tracking-tight">
          {mode === "signin"
            ? "Sign in"
            : mode === "signup"
              ? "Create your account"
              : mode === "forgot"
                ? "Forgot password"
                : "Verify your email"}
        </h2>
        <p className="mt-2 text-[13px] leading-6 text-white/50">
          {mode === "verify"
            ? "Check your inbox and verify your email to continue."
            : mode === "forgot"
              ? "Enter your email and we'll send you a reset link."
              : "Publish prompts and workflows under your handle."}
        </p>

        {mode !== "verify" && mode !== "forgot" ? (
          <div className="relative mt-6 rounded-[18px] border border-white/10 bg-white/[0.03] p-2">
            <GlowBehindFooterCTA />
            <button
              type="button"
              onClick={handleGoogle}
              disabled={busy}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 text-[13px] font-semibold text-black transition-colors hover:bg-white/95 disabled:opacity-50"
            >
              <span className="flex items-center justify-center gap-3">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <Image src="/misc/google.png" alt="Google" width={18} height={18} priority />
                Continue with Google
              </span>
            </button>
          </div>
        ) : null}

        {mode !== "verify" ? (
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <div className="text-xs text-white/45">or</div>
            <div className="h-px flex-1 bg-white/10" />
          </div>
        ) : null}

        {mode === "forgot" ? (
          <div className="mt-2 space-y-3">
            {forgotSent ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                <div className="text-sm font-semibold text-emerald-300">Check your email</div>
                <div className="mt-2 text-sm text-white/70">
                  We sent a password reset link to <span className="text-white">{email}</span>.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setForgotSent(false);
                    setError(null);
                  }}
                  className="mt-4 text-sm font-semibold text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <>
                <input
                  placeholder="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-black px-4 text-[14px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/20"
                  autoComplete="email"
                />
                <div className="relative rounded-[18px] border border-white/10 bg-white/[0.03] p-2">
                  <GlowBehindFooterCTA />
                  <button
                    type="button"
                    onClick={handleForgot}
                    disabled={busy || !email.trim()}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 text-[13px] font-semibold text-black transition-colors hover:bg-white/95 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Send reset link
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                  }}
                  className="w-full text-sm text-white/70 hover:text-white"
                >
                  Back to sign in
                </button>
              </>
            )}
          </div>
        ) : mode === "verify" ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-white/70">
            Once verified, come back here and continue.
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === "signup") void handleSignup();
              else void handleSignin();
            }}
            className="space-y-3"
          >
            {mode === "signup" ? (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/70">Full name</label>
                <input
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-black px-4 text-[14px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/20"
                  autoComplete="name"
                  required
                />
              </div>
            ) : null}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/70">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-black px-4 text-[14px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/20"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/70">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-black px-4 text-[14px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/20"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
              />
            </div>

            {mode === "signup" ? (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/70">
                  Confirm password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-white/10 bg-black px-4 text-[14px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/20"
                  autoComplete="new-password"
                  required
                />
              </div>
            ) : null}

            {mode === "signin" ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setError(null);
                  }}
                  className="text-sm font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  Forgot password?
                </button>
              </div>
            ) : null}

            <div className="relative rounded-[18px] border border-white/10 bg-white/[0.03] p-2">
              <GlowBehindFooterCTA />
              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 text-[13px] font-semibold text-black transition-colors hover:bg-white/95 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {mode === "signup" ? "Create account" : "Sign in"}
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 text-center text-sm text-white/60">
          {mode === "signin" ? (
            <>
              New to Edgaze?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                }}
                className="font-semibold text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
              >
                Create account
              </button>
            </>
          ) : mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                }}
                className="font-semibold text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
              >
                Sign in
              </button>
            </>
          ) : null}
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}
      </div>
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
  const [postAuthStep, setPostAuthStep] = useState<LaunchStep>("intent");
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

  const contentMax = step === "intent" ? "max-w-2xl" : "max-w-3xl";

  const contentMaxResolved = step === "intent" || step === "auth" ? "max-w-2xl" : "max-w-3xl";

  const goBack = () => {
    const index = stepIndex(step);
    if (index <= 0) return;
    setStep(STEPS[index - 1]?.key ?? "intent");
  };

  useEffect(() => {
    if (!open) return;
    if (!authReady) return;
    if (userId && step === "auth") {
      setStep(postAuthStep === "auth" ? "intent" : postAuthStep);
    }
  }, [open, authReady, userId, step, postAuthStep]);

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
    (step === "preview" && !hasDraft && intent === "custom") ||
    (step === "position" && !hasDraft);

  const primaryLabel =
    step === "intent"
      ? "Continue"
      : step === "draft"
        ? creating
          ? "Creating..."
          : "Create workflow draft"
        : step === "preview"
          ? !hasDraft
            ? "Create draft"
            : running
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

    try {
      if (!userId) {
        setPostAuthStep(step);
        setStep("auth");
        return;
      }
      if (step === "intent") {
        if (!intent) {
          setLocalError("Choose what you want to sell first.");
          return;
        }
        setStep(intent === "custom" ? "draft" : "preview");
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
        if (!hasDraft) {
          if (intent === "image") {
            await onCreateQuickStart("images");
            setTitle(defaultTitleForIntent("image"));
            setDescription("Generate polished image concepts from a buyer's prompt.");
            return;
          }
          if (intent === "writing") {
            await onCreateQuickStart("writer");
            setTitle(defaultTitleForIntent("writing"));
            setDescription("Generate ready-to-use writing from a buyer's topic.");
            return;
          }
        }
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
    <div className="fixed inset-0 z-[900] overflow-hidden bg-black text-white">
      <PremiumBlackBackdrop />
      <div className="relative flex h-full flex-col">
        <header className="shrink-0 px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/brand/edgaze-mark.png" alt="Edgaze" className="h-8 w-8" />
              <span className="text-[14px] font-semibold tracking-tight text-white">Edgaze</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-xl text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-20 pt-6 sm:px-6 sm:pt-10">
          <div className={cx("mx-auto w-full", contentMaxResolved)}>
            <section className="min-w-0 p-0">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                >
                  {step === "auth" && <EmbeddedSignIn />}
                  {step === "intent" && (
                    <div className="pt-6 sm:pt-10">
                      <h1 className="text-[32px] font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl">
                        What do you want to sell?
                      </h1>
                      <p className="mt-3 text-[14px] leading-6 text-white/50">
                        Pick one to continue.
                      </p>
                      <div className="mt-7 space-y-3">
                        <IntentRow
                          title="AI Image Style"
                          description="Start from the image quick start."
                          icon={<ImageIcon className="h-5 w-5" />}
                          active={intent === "image"}
                          onClick={() => {
                            setIntent("image");
                            setStep("preview");
                          }}
                        />
                        <IntentRow
                          title="Content / Writing Workflow"
                          description="Start from the writing quick start."
                          icon={<FileText className="h-5 w-5" />}
                          active={intent === "writing"}
                          onClick={() => {
                            setIntent("writing");
                            setStep("preview");
                          }}
                        />
                        <IntentRow
                          title="Custom Prompt"
                          description="Paste your prompt and generate a draft."
                          icon={<Wand2 className="h-5 w-5" />}
                          active={intent === "custom"}
                          onClick={() => {
                            setIntent("custom");
                            setStep("draft");
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {step === "draft" && (
                <div className="pt-6 sm:pt-10">
                  <h1 className="text-[28px] font-semibold leading-[1.06] tracking-tight text-white sm:text-4xl">
                    Paste your prompt
                  </h1>
                  <p className="mt-3 text-[14px] leading-6 text-white/50">
                    We’ll generate a draft workflow you can publish.
                  </p>
                  <textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Paste the prompt, style recipe, or workflow instructions people should be able to run..."
                    className="mt-7 min-h-[230px] w-full resize-y rounded-2xl border border-white/10 bg-black p-4 text-[15px] leading-6 text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/20"
                  />
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Product title, optional"
                    className="mt-4 h-14 w-full rounded-2xl border border-white/10 bg-black px-4 text-[15px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/20"
                  />
                </div>
                  )}

                  {step === "preview" && (
                <div className="pt-6 sm:pt-10">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h1 className="text-[28px] font-semibold leading-[1.06] tracking-tight text-white sm:text-4xl">
                        Preview
                      </h1>
                      <p className="mt-3 text-[14px] leading-6 text-white/50">
                        Run a buyer-style preview.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep("inputs")}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit inputs
                    </button>
                  </div>

                  <pre className="mt-7 min-h-[260px] whitespace-pre-wrap rounded-2xl border border-white/10 bg-black p-4 text-sm leading-6 text-white/75">
                    {outputPreview || "Run preview to see output here."}
                  </pre>
                  {runState?.status === "success" ? (
                    <button
                      type="button"
                      onClick={() => setStep("position")}
                      className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-black transition-colors hover:bg-white/95"
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
                        No input nodes found. Add an input node in the builder.
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

                  {(step !== "intent" && (localError || error)) && (
                    <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">
                      {localError || error}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </section>

            {/* stripped: no sidebar / path / advanced edit */}
          </div>
        </main>

        {step !== "share" && step !== "intent" && step !== "auth" ? (
          <div className="px-4 pb-10 sm:px-6">
            <div className={cx("mx-auto w-full", contentMax)}>
              <div className="mt-8 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={goBack}
                  className="rounded-xl px-4 py-2 text-[13px] font-medium text-white/60 hover:text-white/85 hover:bg-white/[0.04] transition-colors"
                >
                  Back
                </button>
                <div className="relative rounded-[18px] border border-white/10 bg-white/[0.03] p-2">
                  <GlowBehindFooterCTA />
                  <button
                    type="button"
                    onClick={handlePrimary}
                    disabled={primaryDisabled || creating || running}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-[13px] font-semibold text-black transition-colors hover:bg-white/95 disabled:opacity-50"
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
            </div>
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[1] px-4 text-center text-[11px] text-white/28">
          © 2026 Edge Platforms, Inc.
        </div>
      </div>
    </div>
  );
}

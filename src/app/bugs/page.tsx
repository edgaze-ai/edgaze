"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle2, UploadCloud, X, XCircle } from "lucide-react";

function cn(...args: Array<string | false | null | undefined>) {
  return args.filter(Boolean).join(" ");
}

function Gradients() {
  return (
    <>
      <div className="fixed inset-0 -z-10 bg-[#07080b]" />
      <div className="fixed inset-0 -z-10 opacity-70 [background-image:radial-gradient(circle_at_18%_10%,rgba(34,211,238,0.22),transparent_46%),radial-gradient(circle_at_82%_18%,rgba(236,72,153,0.18),transparent_46%),radial-gradient(circle_at_55%_90%,rgba(34,211,238,0.08),transparent_52%)]" />
      <div className="fixed inset-0 -z-10 opacity-[0.10] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:92px_92px]" />
    </>
  );
}

function AccentLine() {
  return (
    <div className="h-[2px] w-full bg-[linear-gradient(90deg,rgba(34,211,238,0.95),rgba(236,72,153,0.9))]" />
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-[#0b0c11] ring-1 ring-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.55)] overflow-hidden">
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold tracking-widest text-white/55">{children}</div>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white",
        "placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20",
        props.className
      )}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white",
        "placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20",
        props.className
      )}
    />
  );
}

function Option({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full text-left rounded-2xl px-4 py-4 ring-1 transition-all",
        selected
          ? "bg-white/10 ring-white/20 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_0_45px_rgba(34,211,238,0.10)]"
          : "bg-white/5 ring-white/10 hover:bg-white/7"
      )}
    >
      {selected ? (
        <>
          <div className="pointer-events-none absolute inset-0 rounded-2xl p-[1px] bg-[linear-gradient(135deg,rgba(34,211,238,0.9),rgba(236,72,153,0.85))]" />
          <div className="absolute right-3 top-3 rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1 text-xs text-white/80">
            Selected
          </div>
        </>
      ) : null}
      <div className="relative text-sm text-white/85 leading-snug pr-24">{children}</div>
    </button>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-2 text-sm ring-1 transition-all",
        active
          ? "bg-white/10 ring-white/20 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_0_35px_rgba(236,72,153,0.10)]"
          : "bg-white/5 ring-white/10 hover:bg-white/7",
        "text-white/85"
      )}
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group relative inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white",
        disabled ? "opacity-60 cursor-not-allowed" : "hover:opacity-[0.98]"
      )}
    >
      <span className="absolute inset-0 rounded-2xl p-[1px] bg-[linear-gradient(135deg,rgba(34,211,238,0.92),rgba(236,72,153,0.88))]" />
      <span className="absolute inset-[1px] rounded-2xl bg-[#0b0c11]" />
      <span className="relative inline-flex items-center gap-2">
        {children}
        <ArrowRight className="h-4 w-4 opacity-90 transition-transform duration-300 group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-white/90 bg-white/5 ring-1 ring-white/10 hover:bg-white/8 transition-colors"
    >
      {children}
    </button>
  );
}

type Category = "ui_visual" | "broken_flow" | "data_issue" | "performance" | "error_crash";
type FeatureArea =
  | "prompt_marketplace"
  | "prompt_studio"
  | "workflow_builder"
  | "purchases"
  | "account_auth"
  | "other";
type DeviceType = "desktop" | "mobile";
type BrowserType = "chrome" | "safari" | "firefox" | "edge" | "other";
type Severity = "blocking" | "major" | "minor";

const MAX_FILES = 3;
const MAX_FILE_MB = 20;

const LS_KEY = "edgaze_bug_draft_v1";

function sanitizeText(s: string) {
  return (s || "").replace(/\s+/g, " ").trim();
}
function clampLen(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max);
}
function safeStringArray<T extends string>(v: unknown): T[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x : ""))
    .map((x) => x.trim())
    .filter(Boolean) as T[];
}

function bytesToMb(n: number) {
  return Math.round((n / (1024 * 1024)) * 10) / 10;
}
function guessBrowser(): BrowserType {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("edg/")) return "edge";
  if (ua.includes("chrome") && !ua.includes("edg/")) return "chrome";
  if (ua.includes("safari") && !ua.includes("chrome")) return "safari";
  if (ua.includes("firefox")) return "firefox";
  return "other";
}
function guessDevice(): DeviceType {
  if (typeof window === "undefined") return "desktop";
  return window.matchMedia("(max-width: 768px)").matches ? "mobile" : "desktop";
}

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; id: string }
  | { status: "error"; message: string };

export default function BugsPage() {
  const reduce = useReducedMotion();

  const [hydrated, setHydrated] = useState(false);
  const [errorTop, setErrorTop] = useState<string>("");

  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });

  // Bug report fields (optimized, but same UI patterns as the apply file)
  const [category, setCategory] = useState<Category | null>(null);
  const [summary, setSummary] = useState("");
  const [steps, setSteps] = useState("1.\n2.\n3.");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");

  const [featureArea, setFeatureArea] = useState<FeatureArea | null>(null);

  const [deviceType, setDeviceType] = useState<DeviceType>(() => guessDevice());
  const [browser, setBrowser] = useState<BrowserType>(() => guessBrowser());

  const [severity, setSeverity] = useState<Severity | null>(null);

  const [allowFollowUp, setAllowFollowUp] = useState<"yes" | "no" | null>(null);
  const [contact, setContact] = useState("");

  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const topRef = useRef<HTMLDivElement | null>(null);

  const categoryOptions = useMemo(
    () =>
      [
        { value: "ui_visual", label: "UI / visual issue" },
        { value: "broken_flow", label: "Broken flow (action doesn’t complete)" },
        { value: "data_issue", label: "Data issue (wrong or missing data)" },
        { value: "performance", label: "Performance / lag" },
        { value: "error_crash", label: "Error message / crash" },
      ] as Array<{ value: Category; label: string }>,
    []
  );

  const featureOptions = useMemo(
    () =>
      [
        { value: "prompt_marketplace", label: "Prompt marketplace" },
        { value: "prompt_studio", label: "Prompt Studio" },
        { value: "workflow_builder", label: "Workflow builder" },
        { value: "purchases", label: "Purchases" },
        { value: "account_auth", label: "Account / auth" },
        { value: "other", label: "Other" },
      ] as Array<{ value: FeatureArea; label: string }>,
    []
  );

  const severityOptions = useMemo(
    () =>
      [
        { value: "blocking", label: "🚨 Blocks me completely" },
        { value: "major", label: "⚠️ Major issue, workaround exists" },
        { value: "minor", label: "🟡 Minor / visual issue" },
      ] as Array<{ value: Severity; label: string }>,
    []
  );

  const followUpOptions = useMemo(
    () =>
      [
        { value: "yes", label: "Yes, you can contact me" },
        { value: "no", label: "No" },
      ] as Array<{ value: "yes" | "no"; label: string }>,
    []
  );

  // hydrate draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        const tick = () => {
          setCategory(d.category ?? null);
          setSummary(d.summary ?? "");
          setSteps(d.steps ?? "1.\n2.\n3.");
          setExpected(d.expected ?? "");
          setActual(d.actual ?? "");
          setFeatureArea(d.featureArea ?? null);
          setDeviceType(d.deviceType ?? guessDevice());
          setBrowser(d.browser ?? guessBrowser());
          setSeverity(d.severity ?? null);
          setAllowFollowUp(d.allowFollowUp ?? null);
          setContact(d.contact ?? "");
          setFiles([]); // don't persist files
        };
        queueMicrotask(tick);
      }
    } catch {}
    queueMicrotask(() => setHydrated(true));
  }, []);

  // persist draft
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          category,
          summary,
          steps,
          expected,
          actual,
          featureArea,
          deviceType,
          browser,
          severity,
          allowFollowUp,
          contact,
          savedAt: Date.now(),
        })
      );
    } catch {}
  }, [
    hydrated,
    category,
    summary,
    steps,
    expected,
    actual,
    featureArea,
    deviceType,
    browser,
    severity,
    allowFollowUp,
    contact,
  ]);

  function validate(): { ok: true } | { ok: false; message: string } {
    if (!category) return { ok: false, message: "Select the bug category." };
    if (sanitizeText(summary).length < 4) return { ok: false, message: "Describe what went wrong in one sentence." };
    if (sanitizeText(steps).length < 10) return { ok: false, message: "Add steps to reproduce (minimum 3 steps)." };
    if (sanitizeText(expected).length < 2) return { ok: false, message: "Fill expected behaviour." };
    if (sanitizeText(actual).length < 2) return { ok: false, message: "Fill actual behaviour." };
    if (!featureArea) return { ok: false, message: "Select where this happened." };
    if (!severity) return { ok: false, message: "Select severity." };
    if (!allowFollowUp) return { ok: false, message: "Select whether we can follow up." };
    if (allowFollowUp === "yes" && sanitizeText(contact).length < 4) {
      return { ok: false, message: "If follow-up is Yes, provide email or X handle." };
    }
    if (files.length > MAX_FILES) return { ok: false, message: `Max ${MAX_FILES} attachments.` };
    for (const f of files) {
      const okType = f.type.startsWith("image/") || f.type.startsWith("video/");
      if (!okType) return { ok: false, message: "Attachments must be images or videos." };
      if (f.size > MAX_FILE_MB * 1024 * 1024) return { ok: false, message: `Max ${MAX_FILE_MB}MB per file.` };
    }
    return { ok: true };
  }

  function addFiles(incoming: File[]) {
    const cleaned: File[] = [];
    for (const f of incoming) {
      const okType = f.type.startsWith("image/") || f.type.startsWith("video/");
      if (!okType) continue;
      if (f.size > MAX_FILE_MB * 1024 * 1024) continue;
      cleaned.push(f);
    }
    setFiles((prev) => [...prev, ...cleaned].slice(0, MAX_FILES));
  }

  async function submit() {
    setErrorTop("");
    const v = validate();
    if (!v.ok) {
      setErrorTop(v.message);
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    setSubmitState({ status: "submitting" });

    try {
      const url = typeof window !== "undefined" ? window.location.href : "";
      const routePath = typeof window !== "undefined" ? window.location.pathname : "";
      const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";

      const fd = new FormData();
      fd.set("category", category!);
      fd.set("summary", sanitizeText(summary));
      fd.set("steps_to_reproduce", steps.trim());
      fd.set("expected_behavior", sanitizeText(expected));
      fd.set("actual_behavior", sanitizeText(actual));
      fd.set("feature_area", featureArea!);
      fd.set("device_type", deviceType);
      fd.set("browser", browser);
      fd.set("severity", severity!);

      fd.set("allow_follow_up", String(allowFollowUp === "yes"));
      fd.set("reporter_contact", allowFollowUp === "yes" ? sanitizeText(contact) : "");

      fd.set("current_url", url);
      fd.set("route_path", routePath);
      fd.set("user_agent", userAgent);

      fd.set("app_version", process.env.NEXT_PUBLIC_APP_VERSION ?? "");
      fd.set("build_hash", process.env.NEXT_PUBLIC_BUILD_HASH ?? "");

      for (const f of files) fd.append("files", f);

      const res = await fetch("/api/bugs", { method: "POST", body: fd });
      const j = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = j?.error ?? `Request failed (${res.status})`;
        setSubmitState({ status: "error", message: msg });
        return;
      }

      const id = j?.id ? String(j.id) : "saved";
      setSubmitState({ status: "success", id });

      // clear draft
      try {
        localStorage.removeItem(LS_KEY);
      } catch {}

      // reset form
      setCategory(null);
      setSummary("");
      setSteps("1.\n2.\n3.");
      setExpected("");
      setActual("");
      setFeatureArea(null);
      setDeviceType(guessDevice());
      setBrowser(guessBrowser());
      setSeverity(null);
      setAllowFollowUp(null);
      setContact("");
      setFiles([]);
      setErrorTop("");

      setTimeout(() => {
        document.getElementById("bugs-end")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (e: any) {
      setSubmitState({ status: "error", message: e?.message || "Failed to submit." });
    }
  }

  function reset() {
    setCategory(null);
    setSummary("");
    setSteps("1.\n2.\n3.");
    setExpected("");
    setActual("");
    setFeatureArea(null);
    setDeviceType(guessDevice());
    setBrowser(guessBrowser());
    setSeverity(null);
    setAllowFollowUp(null);
    setContact("");
    setFiles([]);
    setErrorTop("");
    setSubmitState({ status: "idle" });
    try {
      localStorage.removeItem(LS_KEY);
    } catch {}
  }

  const submitting = submitState.status === "submitting";

  return (
    <div
      className="fixed inset-0 overflow-y-auto overscroll-contain text-white"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <Gradients />

      <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:py-12">
        <Frame>
          <div className="p-6 sm:p-8">
            <div ref={topRef} />

            {/* NO HEADER / NO TOPBAR — matches the pattern, but without the marketplace pill */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold tracking-widest text-white/55">EDGAZE SUPPORT</div>
                <h1 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-white">🐞 Report a bug</h1>
                <p className="mt-3 text-sm text-white/70 leading-relaxed">
                  Help us fix this fast. This takes under 2 minutes.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <AccentLine />
            </div>

            <AnimatePresence>
              {errorTop ? (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={reduce ? undefined : { opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: 6 }}
                  className="mt-6 rounded-2xl bg-red-500/10 ring-1 ring-red-500/20 px-4 py-3 text-sm text-red-200"
                >
                  {errorTop}
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="mt-8 space-y-8">
              {/* 1. Category */}
              <div className="space-y-3">
                <FieldLabel>1. BUG CATEGORY *</FieldLabel>
                <div className="grid grid-cols-1 gap-2">
                  {categoryOptions.map((o) => (
                    <Option key={o.value} selected={category === o.value} onClick={() => setCategory(o.value)}>
                      {o.label}
                    </Option>
                  ))}
                </div>
              </div>

              {/* 2. Summary */}
              <div className="space-y-3">
                <FieldLabel>2. WHAT WENT WRONG? *</FieldLabel>
                <div className="text-xs text-white/45">
                  One clear sentence. Example: “Workflow preview stays stuck on loading after purchase.”
                </div>
                <Input
                  value={summary}
                  onChange={(e) => setSummary(clampLen(e.target.value, 180))}
                  placeholder="Describe the issue"
                />
                <div className="text-xs text-white/45">{summary.length}/180</div>
              </div>

              {/* 3. Steps */}
              <div className="space-y-3">
                <FieldLabel>3. STEPS TO REPRODUCE *</FieldLabel>
                <div className="text-xs text-white/45">If we can’t reproduce it, we can’t fix it.</div>
                <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-4">
                  <Textarea value={steps} onChange={(e) => setSteps(clampLen(e.target.value, 4000))} rows={5} />
                  <div className="mt-2 text-xs text-white/45">{steps.length}/4000</div>
                </div>
              </div>

              {/* 4. Expected vs Actual */}
              <div className="space-y-3">
                <FieldLabel>4. EXPECTED VS ACTUAL *</FieldLabel>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold tracking-widest text-white/55">EXPECTED</div>
                    <Input
                      value={expected}
                      onChange={(e) => setExpected(clampLen(e.target.value, 1000))}
                      placeholder="What should have happened?"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold tracking-widest text-white/55">ACTUAL</div>
                    <Input
                      value={actual}
                      onChange={(e) => setActual(clampLen(e.target.value, 1000))}
                      placeholder="What actually happened?"
                    />
                  </div>
                </div>
              </div>

              {/* 5. Where */}
              <div className="space-y-3">
                <FieldLabel>5. WHERE DID THIS HAPPEN? *</FieldLabel>

                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {featureOptions.map((o) => (
                      <Chip key={o.value} active={featureArea === o.value} onClick={() => setFeatureArea(o.value)}>
                        {o.label}
                      </Chip>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-xs font-semibold tracking-widest text-white/55">DEVICE</div>
                      <select
                        value={deviceType}
                        onChange={(e) => setDeviceType(e.target.value as DeviceType)}
                        className="w-full rounded-2xl bg-white/5 ring-1 ring-white/10 px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                      >
                        <option value="desktop">Desktop</option>
                        <option value="mobile">Mobile</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-semibold tracking-widest text-white/55">BROWSER</div>
                      <select
                        value={browser}
                        onChange={(e) => setBrowser(e.target.value as BrowserType)}
                        className="w-full rounded-2xl bg-white/5 ring-1 ring-white/10 px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                      >
                        <option value="chrome">Chrome</option>
                        <option value="safari">Safari</option>
                        <option value="firefox">Firefox</option>
                        <option value="edge">Edge</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* 6. Severity */}
              <div className="space-y-3">
                <FieldLabel>6. HOW BAD IS THIS? *</FieldLabel>
                <div className="grid grid-cols-1 gap-2">
                  {severityOptions.map((o) => (
                    <Option key={o.value} selected={severity === o.value} onClick={() => setSeverity(o.value)}>
                      {o.label}
                    </Option>
                  ))}
                </div>
              </div>

              {/* 7. Attachments */}
              <div className="space-y-3">
                <FieldLabel>7. SCREENSHOT / SCREEN RECORDING (OPTIONAL)</FieldLabel>
                <div className="text-xs text-white/45">
                  Drag & drop supported. Up to {MAX_FILES} files. Max {MAX_FILE_MB}MB each. Images/videos only.
                </div>

                <div
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragActive(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragActive(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragActive(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragActive(false);
                    addFiles(Array.from(e.dataTransfer.files || []));
                  }}
                  className={cn(
                    "rounded-3xl ring-1 p-5 transition-all",
                    dragActive ? "bg-white/6 ring-white/20" : "bg-white/4 ring-white/10"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-white/6 ring-1 ring-white/10 p-3">
                        <UploadCloud className="h-5 w-5 text-white/80" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">Drop files here</div>
                        <div className="text-xs text-white/55">or click to choose</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-2xl px-4 py-3 text-sm font-semibold text-white/90 bg-white/5 ring-1 ring-white/10 hover:bg-white/8 transition-colors"
                    >
                      Choose files
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      addFiles(Array.from(e.target.files || []));
                      e.currentTarget.value = "";
                    }}
                  />

                  {files.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {files.map((f, idx) => (
                        <div
                          key={`${f.name}-${idx}`}
                          className="flex items-center justify-between rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <div className="text-sm text-white/85 truncate">{f.name}</div>
                            <div className="text-xs text-white/50">
                              {(f.type || "file").toLowerCase()} • {bytesToMb(f.size)}MB
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                            className="rounded-xl p-2 hover:bg-white/10 transition-colors"
                            aria-label="Remove file"
                          >
                            <X className="h-4 w-4 text-white/70" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* 8. Follow up */}
              <div className="space-y-3">
                <FieldLabel>8. CAN WE FOLLOW UP? *</FieldLabel>
                <div className="grid grid-cols-1 gap-2">
                  {followUpOptions.map((o) => (
                    <Option
                      key={o.value}
                      selected={allowFollowUp === o.value}
                      onClick={() => setAllowFollowUp(o.value)}
                    >
                      {o.label}
                    </Option>
                  ))}
                </div>

                <AnimatePresence>
                  {allowFollowUp === "yes" ? (
                    <motion.div
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={reduce ? undefined : { opacity: 1, y: 0 }}
                      exit={reduce ? undefined : { opacity: 0, y: 8 }}
                      transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
                      className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-4"
                    >
                      <div className="space-y-2">
                        <div className="text-xs font-semibold tracking-widest text-white/55">EMAIL OR X HANDLE</div>
                        <Input
                          value={contact}
                          onChange={(e) => setContact(clampLen(e.target.value, 120))}
                          placeholder="name@email.com or @handle"
                        />
                        <div className="text-xs text-white/45">{contact.length}/120</div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-2">
                <SecondaryButton onClick={reset}>Reset</SecondaryButton>
                <PrimaryButton disabled={submitting} onClick={submit}>
                  {submitting ? "Submitting…" : "Submit"}
                </PrimaryButton>
              </div>

              {/* End panel (same pattern as apply/feedback) */}
              <div id="bugs-end" className="pt-2">
                <AnimatePresence>
                  {submitState.status === "success" ? (
                    <motion.div
                      initial={reduce ? false : { opacity: 0, y: 10 }}
                      animate={reduce ? undefined : { opacity: 1, y: 0 }}
                      exit={reduce ? undefined : { opacity: 0, y: 10 }}
                      className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-6"
                    >
                      <div className="inline-flex items-center gap-2 rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-1 text-xs text-white/70">
                        <CheckCircle2 className="h-4 w-4 text-white/75" />
                        Bug received
                      </div>
                      <div className="mt-4 text-sm text-white/80">
                        Thanks for reporting this. Critical issues are prioritised automatically.
                      </div>

                      <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <PrimaryButton onClick={() => (window.location.href = "/marketplace")}>
                          Go to marketplace
                        </PrimaryButton>
                        <SecondaryButton onClick={reset}>Submit another</SecondaryButton>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <AnimatePresence>
                  {submitState.status === "error" ? (
                    <motion.div
                      initial={reduce ? false : { opacity: 0, y: 10 }}
                      animate={reduce ? undefined : { opacity: 1, y: 0 }}
                      exit={reduce ? undefined : { opacity: 0, y: 10 }}
                      className="rounded-3xl bg-red-500/10 ring-1 ring-red-500/20 p-6"
                    >
                      <div className="inline-flex items-center gap-2 rounded-full bg-red-500/10 ring-1 ring-red-500/20 px-3 py-1 text-xs text-red-200">
                        <XCircle className="h-4 w-4 text-red-200" />
                        Failed
                      </div>

                      <div className="mt-4 text-sm text-red-100 whitespace-pre-wrap break-words">
                        {submitState.message}
                      </div>

                      <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <PrimaryButton onClick={submit}>Try again</PrimaryButton>
                        <SecondaryButton onClick={() => (window.location.href = "/marketplace")}>
                          Go to marketplace
                        </SecondaryButton>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <div className="text-xs text-white/45">
                Edgaze.
              </div>
            </div>
          </div>
        </Frame>

        <div className="mt-10 text-center text-xs text-white/45">© Edgaze 2026. All rights reserved.</div>
      </div>
    </div>
  );
}

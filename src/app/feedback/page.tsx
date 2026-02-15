"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

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
  return <div className="h-[2px] w-full bg-[linear-gradient(90deg,rgba(34,211,238,0.95),rgba(236,72,153,0.9))]" />;
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

type RoleOption = "ai_power_user" | "creator" | "developer" | "student" | "exploring";
type TriedOption =
  | "prompt_marketplace"
  | "prompt_studio"
  | "workflow_builder"
  | "buying_or_viewing_paid"
  | "just_browsing";
type FrictionOption =
  | "understanding_first_step"
  | "ui_navigation"
  | "prompt_creation"
  | "workflow_builder"
  | "sharing_previewing"
  | "performance_bugs"
  | "didnt_feel_useful";
type UsefulOption = "prompt_marketplace" | "prompt_studio" | "workflows" | "nothing_yet";
type ComeBack = "yes" | "maybe" | "no";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const sb = supabaseUrl && supabaseAnon ? createClient(supabaseUrl, supabaseAnon) : null;

const LS_KEY = "edgaze_feedback_draft_v5";

function sanitizeText(s: string) {
  return (s || "").replace(/\s+/g, " ").trim();
}
function clampLen(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max);
}
function toggleMulti<T extends string>(arr: T[], v: T) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}
function safeStringArray<T extends string>(v: unknown): T[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? String(x) : ""))
    .map((x) => x.trim())
    .filter((x) => x.length > 0) as T[];
}

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; id: string }
  | { status: "error"; message: string };

export default function FeedbackPage() {
  const reduce = useReducedMotion();

  const [hydrated, setHydrated] = useState(false);
  const [errorTop, setErrorTop] = useState<string>("");

  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });

  const [role, setRole] = useState<RoleOption | null>(null);
  const [tried, setTried] = useState<TriedOption[]>([]);
  const [problem, setProblem] = useState("");

  const [friction, setFriction] = useState<FrictionOption[]>([]);
  const [blocker, setBlocker] = useState("");

  const [useful, setUseful] = useState<UsefulOption | null>(null);
  const [weak, setWeak] = useState("");

  const [alternative, setAlternative] = useState("");
  const [comeBack, setComeBack] = useState<ComeBack | null>(null);
  const [mustChange, setMustChange] = useState("");

  const topRef = useRef<HTMLDivElement | null>(null);

  const roleOptions = useMemo(
    () =>
      [
        { value: "ai_power_user", label: "AI power user (daily prompts/workflows)" },
        { value: "creator", label: "Creator (sharing/selling prompts or tools)" },
        { value: "developer", label: "Developer / technical user" },
        { value: "student", label: "Student / learner" },
        { value: "exploring", label: "Just exploring" },
      ] as Array<{ value: RoleOption; label: string }>,
    []
  );

  const triedOptions = useMemo(
    () =>
      [
        { value: "prompt_marketplace", label: "Prompt marketplace" },
        { value: "prompt_studio", label: "Prompt Studio (create/edit)" },
        { value: "workflow_builder", label: "Workflow builder" },
        { value: "buying_or_viewing_paid", label: "Buying / viewing paid content" },
        { value: "just_browsing", label: "Just browsing" },
      ] as Array<{ value: TriedOption; label: string }>,
    []
  );

  const frictionOptions = useMemo(
    () =>
      [
        { value: "understanding_first_step", label: "Understanding what to do first" },
        { value: "ui_navigation", label: "UI / navigation" },
        { value: "prompt_creation", label: "Prompt creation" },
        { value: "workflow_builder", label: "Workflow builder" },
        { value: "sharing_previewing", label: "Sharing / previewing" },
        { value: "performance_bugs", label: "Performance / bugs" },
        { value: "didnt_feel_useful", label: "Didn’t feel useful yet" },
      ] as Array<{ value: FrictionOption; label: string }>,
    []
  );

  const usefulOptions = useMemo(
    () =>
      [
        { value: "prompt_marketplace", label: "Prompt marketplace" },
        { value: "prompt_studio", label: "Prompt Studio" },
        { value: "workflows", label: "Workflows" },
        { value: "nothing_yet", label: "Nothing yet" },
      ] as Array<{ value: UsefulOption; label: string }>,
    []
  );

  const comeBackOptions = useMemo(
    () =>
      [
        { value: "yes", label: "Yes" },
        { value: "maybe", label: "Maybe" },
        { value: "no", label: "No" },
      ] as Array<{ value: ComeBack; label: string }>,
    []
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        const tick = () => {
          setRole(d.role ?? null);
          setTried(safeStringArray<TriedOption>(d.tried));
          setProblem(d.problem ?? "");
          setFriction(safeStringArray<FrictionOption>(d.friction));
          setBlocker(d.blocker ?? "");
          setUseful(d.useful ?? null);
          setWeak(d.weak ?? "");
          setAlternative(d.alternative ?? "");
          setComeBack(d.comeBack ?? null);
          setMustChange(d.mustChange ?? "");
        };
        queueMicrotask(tick);
      }
    } catch {}
    queueMicrotask(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          role,
          tried,
          problem,
          friction,
          blocker,
          useful,
          weak,
          alternative,
          comeBack,
          mustChange,
          savedAt: Date.now(),
        })
      );
    } catch {}
  }, [hydrated, role, tried, problem, friction, blocker, useful, weak, alternative, comeBack, mustChange]);

  function validate(): { ok: true } | { ok: false; message: string } {
    if (!sb) return { ok: false, message: "Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)." };
    if (!role) return { ok: false, message: "Select what best describes you." };
    if (sanitizeText(problem).length < 3) return { ok: false, message: "Answer the problem you were trying to solve." };
    if (!useful) return { ok: false, message: "Select what felt useful (or Nothing yet)." };
    if (sanitizeText(alternative).length < 2) return { ok: false, message: "Answer what you'd use instead today." };
    if (!comeBack) return { ok: false, message: "Select if you'd come back within 7 days." };
    if ((comeBack === "no" || comeBack === "maybe") && sanitizeText(mustChange).length < 3) {
      return { ok: false, message: "If No/Maybe: what must change?" };
    }
    return { ok: true };
  }

  async function submit() {
    setErrorTop("");
    const v = validate();
    if (!v.ok) {
      setErrorTop(v.message);
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (!sb) return;

    setSubmitState({ status: "submitting" });

    try {
      const {
        data: { user },
      } = await sb.auth.getUser();

      // Critical: ensure text[] columns get plain string arrays, never null/undefined/JSON.
      const triedArr = safeStringArray<TriedOption>(tried);
      const frictionArr = safeStringArray<FrictionOption>(friction);

      // Ensure arrays are valid JavaScript arrays (Supabase requirement)
      const triedFinal = Array.isArray(triedArr) ? triedArr : [];
      const frictionFinal = Array.isArray(frictionArr) ? frictionArr : [];

      const payload = {
        user_id: user?.id ?? null,
        context_role: role, // text
        tried: triedFinal, // text[]
        problem_to_solve: sanitizeText(problem),
        friction: frictionFinal, // text[]
        biggest_blocker: sanitizeText(blocker) || null,
        genuinely_useful: useful,
        unfinished_or_weak: sanitizeText(weak) || null,
        alternative_used: sanitizeText(alternative),
        come_back_7d: comeBack,
        must_change: sanitizeText(mustChange) || null,
        page_path: typeof window !== "undefined" ? window.location.pathname : null,
        referrer: typeof document !== "undefined" ? document.referrer || null : null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        viewport:
          typeof window !== "undefined"
            ? `${Math.round(window.innerWidth)}x${Math.round(window.innerHeight)}`
            : null,
        locale: typeof navigator !== "undefined" ? navigator.language : null,
      };

      const { data, error } = await sb.from("feedback_submissions").insert(payload).select("id").single();

      if (error) {
        console.error("feedback insert error (raw):", error);
        try {
          console.error("feedback insert error (json):", JSON.stringify(error, null, 2));
        } catch {}
        setSubmitState({ status: "error", message: error.message || "Insert failed." });
        return;
      }

      const id = data?.id ? String(data.id) : "submitted";
      setSubmitState({ status: "success", id });

      try {
        localStorage.removeItem(LS_KEY);
      } catch {}

      setTimeout(() => {
        document.getElementById("feedback-end")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (e: any) {
      console.error("feedback submit exception:", e);
      setSubmitState({ status: "error", message: e?.message || "Failed to submit." });
    }
  }

  function reset() {
    setRole(null);
    setTried([]);
    setProblem("");
    setFriction([]);
    setBlocker("");
    setUseful(null);
    setWeak("");
    setAlternative("");
    setComeBack(null);
    setMustChange("");
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

            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold tracking-widest text-white/55">EDGAZE</div>
                <h1 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-white">Feedback</h1>
              </div>
              <a
                href="/marketplace"
                className="rounded-full bg-white/5 ring-1 ring-white/10 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/8 transition-colors"
              >
                Marketplace
              </a>
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
              <div className="space-y-3">
                <FieldLabel>WHAT BEST DESCRIBES YOU? *</FieldLabel>
                <div className="grid grid-cols-1 gap-2">
                  {roleOptions.map((o) => (
                    <Option key={o.value} selected={role === o.value} onClick={() => setRole(o.value)}>
                      {o.label}
                    </Option>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <FieldLabel>WHAT DID YOU TRY TODAY?</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {triedOptions.map((o) => (
                    <Chip
                      key={o.value}
                      active={tried.includes(o.value)}
                      onClick={() => setTried((a) => toggleMulti(a, o.value))}
                    >
                      {o.label}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <FieldLabel>WHAT PROBLEM WERE YOU TRYING TO SOLVE TODAY? *</FieldLabel>
                <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-4">
                  <Textarea
                    value={problem}
                    onChange={(e) => setProblem(clampLen(e.target.value, 220))}
                    rows={3}
                    placeholder="1–2 lines"
                  />
                  <div className="mt-2 text-xs text-white/45">{problem.length}/220</div>
                </div>
              </div>

              <div className="space-y-3">
                <FieldLabel>WHERE DID YOU FEEL FRICTION?</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {frictionOptions.map((o) => (
                    <Chip
                      key={o.value}
                      active={friction.includes(o.value)}
                      onClick={() => setFriction((a) => toggleMulti(a, o.value))}
                    >
                      {o.label}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <FieldLabel>BIGGEST BLOCKER (OPTIONAL)</FieldLabel>
                <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-4">
                  <Textarea
                    value={blocker}
                    onChange={(e) => setBlocker(clampLen(e.target.value, 240))}
                    rows={3}
                    placeholder="What blocked you?"
                  />
                  <div className="mt-2 text-xs text-white/45">{blocker.length}/240</div>
                </div>
              </div>

              <div className="space-y-3">
                <FieldLabel>WHICH PART FELT USEFUL? *</FieldLabel>
                <div className="grid grid-cols-1 gap-2">
                  {usefulOptions.map((o) => (
                    <Option key={o.value} selected={useful === o.value} onClick={() => setUseful(o.value)}>
                      {o.label}
                    </Option>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <FieldLabel>WHAT FELT WEAK? (OPTIONAL)</FieldLabel>
                <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-4">
                  <Textarea value={weak} onChange={(e) => setWeak(clampLen(e.target.value, 240))} rows={3} />
                  <div className="mt-2 text-xs text-white/45">{weak.length}/240</div>
                </div>
              </div>

              <div className="space-y-3">
                <FieldLabel>WHAT WOULD YOU USE INSTEAD TODAY? *</FieldLabel>
                <Input value={alternative} onChange={(e) => setAlternative(clampLen(e.target.value, 120))} />
                <div className="flex flex-wrap gap-2">
                  {["Notion", "Google Docs", "Screenshots", "PromptBase", "Nothing"].map((t) => (
                    <Chip key={t} active={alternative === t} onClick={() => setAlternative(t)}>
                      {t}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <FieldLabel>WOULD YOU COME BACK IN 7 DAYS? *</FieldLabel>
                <div className="grid grid-cols-1 gap-2">
                  {comeBackOptions.map((o) => (
                    <Option key={o.value} selected={comeBack === o.value} onClick={() => setComeBack(o.value)}>
                      {o.label}
                    </Option>
                  ))}
                </div>
              </div>

              {(comeBack === "no" || comeBack === "maybe") ? (
                <div className="space-y-3">
                  <FieldLabel>IF NO/MAYBE: WHAT MUST CHANGE? *</FieldLabel>
                  <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-4">
                    <Textarea
                      value={mustChange}
                      onChange={(e) => setMustChange(clampLen(e.target.value, 240))}
                      rows={3}
                    />
                    <div className="mt-2 text-xs text-white/45">{mustChange.length}/240</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <FieldLabel>WHAT SHOULD IMPROVE? (OPTIONAL)</FieldLabel>
                  <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-4">
                    <Textarea
                      value={mustChange}
                      onChange={(e) => setMustChange(clampLen(e.target.value, 240))}
                      rows={3}
                    />
                    <div className="mt-2 text-xs text-white/45">{mustChange.length}/240</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-2">
                <SecondaryButton onClick={reset}>Reset</SecondaryButton>
                <PrimaryButton disabled={submitting} onClick={submit}>
                  {submitting ? "Submitting…" : "Submit"}
                </PrimaryButton>
              </div>

              <div id="feedback-end" className="pt-2">
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
                        Saved
                      </div>
                      <div className="mt-4 text-sm text-white/80">
                        Reference: <span className="text-white/90">{submitState.id}</span>
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
            </div>
          </div>
        </Frame>

        <div className="mt-10 text-center text-xs text-white/45">© Edgaze 2026. All rights reserved.</div>
      </div>
    </div>
  );
}

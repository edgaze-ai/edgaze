"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, ArrowRight, Sparkles, Search } from "lucide-react";
import TurnstileWidget from "../../components/apply/TurnstileWidget";
import ApplyAuthPanel from "../../components/apply/ApplyAuthPanel";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { useAuth } from "../../components/auth/AuthContext";

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

function SecondaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
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

const COUNTRY_CODES = [
  { code: "+1", label: "US/CA (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+91", label: "India (+91)" },
  { code: "+971", label: "UAE (+971)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+974", label: "Qatar (+974)" },
  { code: "+65", label: "Singapore (+65)" },
];

type Step = "details" | "questions" | "auth" | "checking" | "approved";

export default function ApplyPage() {
  const reduce = useReducedMotion();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { userId, authReady } = useAuth();

  const [step, setStep] = useState<Step>("details");

  // personal details
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [occupation, setOccupation] = useState("");

  // questions
  const [consent, setConsent] = useState(false);
  const [q1, setQ1] = useState<string>("");
  const [q2, setQ2] = useState<string>("");
  const [q3, setQ3] = useState<string>("");
  const [q4, setQ4] = useState<string>("");
  const [q5, setQ5] = useState("");
  const [q6, setQ6] = useState<string>("");

  // captcha (client token) + verification state
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaVerifying, setCaptchaVerifying] = useState(false);
  const [captchaVerified, setCaptchaVerified] = useState(false);

  // server submit / ui
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [applicationId, setApplicationId] = useState<string>("");

  const didAutoContinueRef = useRef(false);

  const phoneFull = `${countryCode}${phone.replace(/\s/g, "")}`;
  const step0Valid =
    fullName.trim().length >= 2 &&
    /^\S+@\S+\.\S+$/.test(email.trim()) &&
    phone.replace(/\D/g, "").length >= 6;

  const q5Trim = q5.trim();
  const q5Valid = q5Trim.length >= 10 && q5Trim.length <= 140;

  const questionsValid =
    consent &&
    q1 &&
    q2 &&
    q3 &&
    q4 === "Yes, I’m happy to give feedback" &&
    q5Valid &&
    q6 &&
    captchaVerified;

  function persistDraft(patch?: Partial<any>) {
    try {
      const raw = sessionStorage.getItem("edgaze:applyDraft");
      const prev = raw ? JSON.parse(raw) : {};
      const next = {
        ...prev,
        ...patch,
        fullName,
        email,
        countryCode,
        phone,
        company,
        occupation,
        consent,
        q1,
        q2,
        q3,
        q4,
        q5,
        q6,
        captchaToken,
        captchaVerified,
      };
      sessionStorage.setItem("edgaze:applyDraft", JSON.stringify(next));
    } catch {}
  }

  function restoreDraft() {
    try {
      const raw = sessionStorage.getItem("edgaze:applyDraft");
      if (!raw) return;
      const d = JSON.parse(raw);
      setFullName(d.fullName || "");
      setEmail(d.email || "");
      setCountryCode(d.countryCode || "+91");
      setPhone(d.phone || "");
      setCompany(d.company || "");
      setOccupation(d.occupation || "");
      setConsent(Boolean(d.consent));
      setQ1(d.q1 || "");
      setQ2(d.q2 || "");
      setQ3(d.q3 || "");
      setQ4(d.q4 || "");
      setQ5(d.q5 || "");
      setQ6(d.q6 || "");
      setCaptchaToken(d.captchaToken || "");
      setCaptchaVerified(Boolean(d.captchaVerified));
    } catch {}
  }

  // Captcha: verify immediately on page 2 and set a server proof cookie
  const onCaptchaToken = useCallback(async (t: string) => {
    setCaptchaToken(t);
    setCaptchaVerified(false);
    persistDraft({ captchaToken: t, captchaVerified: false });

    if (!t) return;

    setCaptchaVerifying(true);
    try {
      const r = await fetch("/api/turnstile/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: t }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Captcha failed");
      setCaptchaVerified(true);
      persistDraft({ captchaVerified: true });
    } catch {
      setCaptchaVerified(false);
      persistDraft({ captchaVerified: false });
    } finally {
      setCaptchaVerifying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore draft + OAuth resume (prevents Google callback dumping you at step 1)
  useEffect(() => {
    restoreDraft();

    try {
      const resume = sessionStorage.getItem("edgaze:apply:resume") === "1";
      const resumeStep = sessionStorage.getItem("edgaze:apply:resumeStep");
      if (resume && resumeStep === "auth") {
        setStep("auth");
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function goToQuestions() {
    setError("");
    if (!step0Valid) {
      setError("Fill your name, a valid email, and a real phone number.");
      return;
    }
    setStep("questions");
  }

  async function goToAuth() {
    setError("");
    if (!questionsValid) {
      setError("Answer everything, commit to feedback (Yes), and verify captcha.");
      return;
    }
    persistDraft();
    setStep("auth");
  }

  async function afterAuthed() {
    // always persist before we leave this state
    persistDraft();

    setStep("checking");
    setError("");

    // 10 seconds always
    await new Promise((r) => setTimeout(r, 10_000));

    setSubmitting(true);
    try {
      const { data } = await supabase.auth.getSession();
      const access_token = data?.session?.access_token;
      if (!access_token) throw new Error("No active session. Sign in again.");

      // Captcha is NOT sent here. It was already verified on page 2 and stored as an httpOnly cookie proof.
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          access_token,

          full_name: fullName,
          email,
          phone_country_code: countryCode,
          phone_number: phone.replace(/\s/g, ""),
          company: company || null,
          occupation: occupation || null,

          feedback_consent: true,

          q1,
          q2,
          q3,
          q4,
          q5: q5Trim,
          q6,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to submit.");

      setApplicationId(String(json.id || ""));
      setStep("approved");

      try {
        sessionStorage.removeItem("edgaze:applyDraft");
        sessionStorage.removeItem("edgaze:apply:resume");
        sessionStorage.removeItem("edgaze:apply:resumeStep");
      } catch {}
    } catch (e: any) {
      setError(e?.message || "Failed to submit.");
      setStep("questions");
    } finally {
      setSubmitting(false);
    }
  }

  // Auto-continue after OAuth return (or if user already signed in on auth step)
  useEffect(() => {
    if (!authReady) return;
    if (!userId) return;
    if (didAutoContinueRef.current) return;

    let shouldContinue = step === "auth";

    try {
      const resume = sessionStorage.getItem("edgaze:apply:resume") === "1";
      const resumeStep = sessionStorage.getItem("edgaze:apply:resumeStep");
      if (resume && resumeStep === "auth") {
        shouldContinue = true;
        if (step !== "auth") setStep("auth");
      }
    } catch {}

    if (!shouldContinue) return;

    didAutoContinueRef.current = true;

    try {
      sessionStorage.removeItem("edgaze:apply:resume");
      sessionStorage.removeItem("edgaze:apply:resumeStep");
    } catch {}

    afterAuthed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, userId, step]);

  return (
    <div className="relative min-h-screen text-white">
      <Gradients />

      <div className="sticky top-0 z-20">
        <div className="bg-[#07080b]/70 backdrop-blur-md ring-1 ring-white/10">
          <div className="mx-auto w-full max-w-4xl px-5 py-4 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
              <img src="/brand/edgaze-mark.png" alt="Edgaze" className="h-9 w-9" />
              <div className="text-sm font-semibold tracking-wide">Edgaze</div>
            </a>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-1 text-xs text-white/70">
              <Sparkles className="h-3.5 w-3.5 text-white/75" />
              Closed beta application
            </div>
          </div>
          <AccentLine />
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:py-12">
        <Frame>
          <div className="p-6 sm:p-8">
            <div>
              <div className="text-xs font-semibold tracking-widest text-white/55">EDGAZE CLOSED BETA</div>
              <h1 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-white">Apply</h1>
              <p className="mt-3 text-sm text-white/70 leading-relaxed">
                By continuing, you agree to our{" "}
                <Link href="/terms" className="text-white/80 hover:text-white underline underline-offset-4">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-white/80 hover:text-white underline underline-offset-4">
                  Privacy Policy
                </Link>
                . By joining closed beta, you agree to give feedback to improve Edgaze.
              </p>
            </div>

            <AnimatePresence mode="wait">
              {step === "details" ? (
                <motion.div
                  key="details"
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={reduce ? undefined : { opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -10 }}
                  transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                  className="mt-8 space-y-6"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <FieldLabel>FULL NAME</FieldLabel>
                      <Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
                    </div>

                    <div className="space-y-2">
                      <FieldLabel>EMAIL</FieldLabel>
                      <Input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        inputMode="email"
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <FieldLabel>PHONE</FieldLabel>
                      <div className="grid grid-cols-[160px_1fr] gap-2">
                        <select
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className="rounded-2xl bg-white/5 ring-1 ring-white/10 px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                        <Input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="Phone number"
                        />
                      </div>
                      <div className="text-xs text-white/45 mt-2">
                        Stored as <span className="text-white/70">{phoneFull}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <FieldLabel>COMPANY (OPTIONAL)</FieldLabel>
                      <Input value={company} onChange={(e) => setCompany(e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <FieldLabel>OCCUPATION (OPTIONAL)</FieldLabel>
                      <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} />
                    </div>
                  </div>

                  <PrimaryButton disabled={!step0Valid} onClick={goToQuestions}>
                    Continue
                  </PrimaryButton>
                </motion.div>
              ) : null}

              {step === "questions" ? (
                <motion.div
                  key="questions"
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={reduce ? undefined : { opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -10 }}
                  transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                  className="mt-8 space-y-8"
                >
                  <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-5">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        className="mt-1 h-4 w-4 accent-white"
                      />
                      <div>
                        <div className="text-sm font-semibold text-white">I will give feedback during beta</div>
                        <p className="mt-1 text-sm text-white/70 leading-relaxed">
                          If something breaks or feels off, I’ll report it.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <FieldLabel>HOW OFTEN DO YOU USE AI TOOLS?</FieldLabel>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        "I’ve tried them a few times",
                        "I use them occasionally (weekly)",
                        "I rely on them daily for work or study",
                        "I use them heavily across multiple workflows every day",
                      ].map((opt) => (
                        <Option key={opt} selected={q1 === opt} onClick={() => setQ1(opt)}>
                          {opt}
                        </Option>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <FieldLabel>WHICH BEST MATCHES WHAT YOU’VE DONE WITH AI?</FieldLabel>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        "Casual use (chatting, homework help, basic questions)",
                        "Structured prompts for real tasks (writing, coding, research, content)",
                        "Connected prompts into repeatable workflows or systems",
                        "Built, shared, or sold AI setups, prompt packs, or tools",
                      ].map((opt) => (
                        <Option key={opt} selected={q2 === opt} onClick={() => setQ2(opt)}>
                          {opt}
                        </Option>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <FieldLabel>WHY DO YOU WANT EDGAZE?</FieldLabel>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        "Run higher-quality prompts and workflows made by others",
                        "Turn my own prompts into something reusable and organized",
                        "Build, publish, and iterate on workflows or prompt packs",
                        "Explore what advanced AI users are building",
                        "Eventually monetize my AI setups",
                      ].map((opt) => (
                        <Option key={opt} selected={q3 === opt} onClick={() => setQ3(opt)}>
                          {opt}
                        </Option>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <FieldLabel>WILL YOU REPORT ISSUES / GIVE FEEDBACK DURING BETA?</FieldLabel>
                    <div className="grid grid-cols-1 gap-2">
                      {["Yes, I’m happy to give feedback", "Maybe, if I have time", "Probably not"].map((opt) => (
                        <Option key={opt} selected={q4 === opt} onClick={() => setQ4(opt)}>
                          {opt}
                        </Option>
                      ))}
                    </div>
                    {q4 && q4 !== "Yes, I’m happy to give feedback" ? (
                      <div className="text-xs text-white/60">
                        You must select <span className="text-white/85">Yes</span> to continue.
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    <FieldLabel>WHAT WILL YOU TRY FIRST?</FieldLabel>
                    <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-4">
                      <Textarea
                        value={q5}
                        onChange={(e) => setQ5(e.target.value)}
                        rows={3}
                        maxLength={140}
                        placeholder="One sentence (10–140 chars)"
                      />
                      <div className="mt-2 flex items-center justify-between text-xs text-white/50">
                        <div className="text-white/40">Example: “Turn my research prompt into a reusable workflow”</div>
                        <div className={cn(q5Trim.length > 140 ? "text-red-300" : "text-white/55")}>
                          {q5Trim.length}/140
                        </div>
                      </div>
                      {!q5Valid && q5Trim.length > 0 ? (
                        <div className="mt-2 text-xs text-white/60">10–140 characters required.</div>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <FieldLabel>HAVE YOU SHARED PROMPTS / WORKFLOWS BEFORE?</FieldLabel>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        "No, never",
                        "Yes, informally (friends, Discord, WhatsApp, Notion)",
                        "Yes, publicly (Twitter, GitHub, Gumroad, etc.)",
                      ].map((opt) => (
                        <Option key={opt} selected={q6 === opt} onClick={() => setQ6(opt)}>
                          {opt}
                        </Option>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-5">
                    <div className="text-sm font-semibold text-white">One last step</div>
                    <div className="mt-2 text-sm text-white/70">Prove you’re human.</div>
                    <div className="mt-4">
                      <TurnstileWidget onToken={onCaptchaToken} />
                    </div>

                    {captchaVerifying ? (
                      <div className="mt-2 text-xs text-white/55">Verifying captcha…</div>
                    ) : captchaVerified ? (
                      <div className="mt-2 text-xs text-emerald-200">Captcha verified</div>
                    ) : (
                      <div className="mt-2 text-xs text-white/55">Captcha required to continue.</div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <SecondaryButton onClick={() => setStep("details")}>Back</SecondaryButton>
                    <PrimaryButton disabled={!questionsValid} onClick={goToAuth}>
                      Continue to sign in
                    </PrimaryButton>
                  </div>
                </motion.div>
              ) : null}

              {step === "auth" ? (
                <motion.div
                  key="auth"
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={reduce ? undefined : { opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -10 }}
                  transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                  className="mt-8"
                >
                  <ApplyAuthPanel emailPrefill={email} fullNamePrefill={fullName} onAuthed={afterAuthed} />
                </motion.div>
              ) : null}

              {step === "checking" ? (
                <motion.div
                  key="checking"
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={reduce ? undefined : { opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -10 }}
                  transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                  className="mt-10"
                >
                  <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-6 sm:p-7 overflow-hidden">
                    <div className="text-xs font-semibold tracking-widest text-white/55">PROCESSING</div>
                    <div className="mt-2 text-2xl font-semibold text-white">Checking your application</div>

                    <div className="mt-6 relative h-[160px] rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
                      <div className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(rgba(255,255,255,0.10)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:36px_36px]" />
                      <motion.div
                        className="absolute left-6 top-6 right-6 bottom-6 rounded-xl border border-white/12 bg-white/[0.03]"
                        initial={false}
                      />

                      <motion.div
                        className="absolute top-[28px] left-[28px] w-[120px] h-[16px] rounded bg-white/10"
                        animate={{ opacity: [0.35, 0.7, 0.35] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                      />
                      <motion.div
                        className="absolute top-[56px] left-[28px] w-[200px] h-[16px] rounded bg-white/10"
                        animate={{ opacity: [0.35, 0.7, 0.35] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
                      />
                      <motion.div
                        className="absolute top-[84px] left-[28px] w-[260px] h-[16px] rounded bg-white/10"
                        animate={{ opacity: [0.35, 0.7, 0.35] }}
                        transition={{ duration: 1.7, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                      />

                      <motion.div
                        className="absolute"
                        animate={{ x: ["10%", "65%", "20%", "75%", "10%"], y: ["20%", "35%", "60%", "45%", "20%"] }}
                        transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
                        style={{ left: 0, top: 0 }}
                      >
                        <div className="rounded-full bg-white/10 ring-1 ring-white/15 p-3 shadow-[0_0_40px_rgba(34,211,238,0.10)]">
                          <Search className="h-5 w-5 text-white/80" />
                        </div>
                      </motion.div>
                    </div>

                    <div className="mt-5 space-y-1 text-sm text-white/70">
                      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }}>
                        Viewing your application…
                      </motion.div>
                      <motion.div
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.8, repeat: Infinity, delay: 0.1 }}
                      >
                        Auto checking…
                      </motion.div>
                      <motion.div
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 2.0, repeat: Infinity, delay: 0.2 }}
                      >
                        Almost there…
                      </motion.div>
                      {submitting ? <div className="text-xs text-white/55 mt-2">Finalizing…</div> : null}
                    </div>
                  </div>
                </motion.div>
              ) : null}

              {step === "approved" ? (
                <motion.div
                  key="approved"
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={reduce ? undefined : { opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -10 }}
                  transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                  className="mt-10"
                >
                  <div className="rounded-3xl bg-white/4 ring-1 ring-white/10 p-6 sm:p-7">
                    <div className="flex items-start gap-4">
                      <CheckCircle2 className="h-6 w-6 text-white/85 mt-0.5" />
                      <div>
                        <div className="text-lg font-semibold text-white">Approved</div>
                        <div className="mt-2 text-sm text-white/70">Welcome. Your application is in.</div>
                        {applicationId ? (
                          <div className="mt-4 text-xs text-white/50">
                            Reference: <span className="text-white/70">{applicationId}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <PrimaryButton onClick={() => (window.location.href = "/marketplace")}>
                        Enter marketplace
                      </PrimaryButton>
                      <SecondaryButton onClick={() => (window.location.href = "/")}>Back to home</SecondaryButton>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <AnimatePresence>
              {error ? (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={reduce ? undefined : { opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: 6 }}
                  className="mt-6 text-sm text-red-300"
                >
                  {error}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </Frame>

        <div className="mt-10 text-center text-xs text-white/45">© Edgaze 2026. All rights reserved.</div>
      </div>
    </div>
  );
}

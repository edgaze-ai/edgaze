"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

type Mode = "signin" | "signup" | "verify";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function passwordStrength(pw: string) {
  const rules = [
    { ok: pw.length >= 12, label: "12+ chars" },
    { ok: /[a-z]/.test(pw), label: "Lowercase" },
    { ok: /[A-Z]/.test(pw), label: "Uppercase" },
    { ok: /\d/.test(pw), label: "Number" },
    { ok: /[^a-zA-Z0-9]/.test(pw), label: "Symbol" },
  ];
  const score = rules.filter((r) => r.ok).length;
  return { score, valid: score === rules.length, rules };
}

function normalizeHandle(input: string) {
  return (input || "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 24);
}

function randomSuffix(len = 4) {
  return Math.random().toString(36).slice(2, 2 + len);
}

function persistApplyDraft(patch: Record<string, any>) {
  try {
    const raw = sessionStorage.getItem("edgaze:applyDraft");
    const prev = raw ? JSON.parse(raw) : {};
    const next = { ...prev, ...patch };
    sessionStorage.setItem("edgaze:applyDraft", JSON.stringify(next));
  } catch {}
}

export default function ApplyAuthPanel({
  emailPrefill,
  fullNamePrefill,
  onAuthed,
}: {
  emailPrefill: string;
  fullNamePrefill: string;
  onAuthed: () => void;
}) {
  const reduce = useReducedMotion();
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState(emailPrefill || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fullName, setFullName] = useState(fullNamePrefill || "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode("signin");
    setEmail(emailPrefill || "");
    setFullName(fullNamePrefill || "");
    setPassword("");
    setConfirm("");
    setError(null);
  }, [emailPrefill, fullNamePrefill]);

  const pw = useMemo(() => passwordStrength(password), [password]);

  async function doSignin() {
    setError(null);
    setBusy(true);
    try {
      await signInWithEmail(email, password);
      onAuthed();
    } catch (e: any) {
      setError(e?.message || "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function doSignup() {
    setError(null);

    if (!pw.valid) {
      setError("Password too weak. Hit all requirements.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const base = normalizeHandle(email.split("@")[0] || "creator");
      const handle = normalizeHandle(`${base}_${randomSuffix(4)}`);

      await signUpWithEmail({
        email,
        password,
        fullName: (fullName || fullNamePrefill || "").trim(),
        handle,
      });

      setMode("verify");
    } catch (e: any) {
      setError(e?.message || "Sign up failed.");
    } finally {
      setBusy(false);
    }
  }

  async function doGoogle() {
    setError(null);
    setBusy(true);
    try {
      // OAuth redirect resets React state. Persist resume + draft BEFORE redirect.
      try {
        sessionStorage.setItem("edgaze:apply:resume", "1");
        sessionStorage.setItem("edgaze:apply:resumeStep", "auth");
      } catch {}

      persistApplyDraft({
        email: (email || emailPrefill || "").trim(),
        fullName: (fullName || fullNamePrefill || "").trim(),
      });

      await signInWithGoogle();
      // no onAuthed() here because redirect breaks execution
    } catch (e: any) {
      setError(e?.message || "Google sign in failed.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl bg-[#0b0c11] ring-1 ring-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.55)] overflow-hidden">
      <div className="h-[2px] w-full bg-[linear-gradient(90deg,rgba(34,211,238,0.95),rgba(236,72,153,0.9))]" />

      <div className="p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold tracking-widest text-white/55">STEP 3 / 3</div>
            <div className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              {mode === "signin"
                ? "Sign in to submit"
                : mode === "signup"
                ? "Create your account"
                : "Verify your email"}
            </div>
            <div className="mt-2 text-sm text-white/70">
              {mode === "verify"
                ? "Open the verification link in your email, then come back and sign in."
                : "By continuing, you agree to submit your application."}
            </div>
          </div>

          <div className="hidden sm:inline-flex items-center gap-2 rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-1 text-xs text-white/70">
            <Sparkles className="h-3.5 w-3.5 text-white/75" />
            Magic auth
          </div>
        </div>

        {mode !== "verify" && (
          <>
            <motion.button
              type="button"
              onClick={doGoogle}
              disabled={busy}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={cn(
                "mt-7 w-full rounded-2xl bg-white text-black py-3 font-semibold",
                "shadow-[0_18px_55px_rgba(255,255,255,0.10)] hover:opacity-95 active:opacity-90",
                busy && "opacity-60 cursor-not-allowed"
              )}
            >
              <span className="flex items-center justify-center gap-3">
                <Image src="/misc/google.png" alt="Google" width={18} height={18} priority />
                Continue with Google
              </span>
            </motion.button>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <div className="text-xs text-white/45">or</div>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                mode === "signup" ? doSignup() : doSignin();
              }}
              className="space-y-3"
            >
              {mode === "signup" && (
                <input
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
                  required
                />
              )}

              <input
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
                autoComplete="email"
                inputMode="email"
                required
              />

              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
              />

              {mode === "signup" && (
                <>
                  <input
                    type="password"
                    placeholder="Confirm password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
                    autoComplete="new-password"
                    required
                  />

                  <div className="rounded-2xl bg-white/4 ring-1 ring-white/10 p-4">
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <div>Password strength</div>
                      <div>{pw.score}/5</div>
                    </div>

                    <div className="mt-2 grid grid-cols-5 gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className={cn("h-1 rounded-full", pw.score > i ? "bg-emerald-400/80" : "bg-white/10")} />
                      ))}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {pw.rules.map((r) => (
                        <div
                          key={r.label}
                          className={cn(
                            "text-[11px] rounded-lg border px-2 py-1",
                            r.ok
                              ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                              : "border-white/10 bg-white/[0.03] text-white/55"
                          )}
                        >
                          {r.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={busy || (mode === "signup" && !pw.valid)}
                className={cn(
                  "w-full rounded-2xl py-3 text-sm font-semibold",
                  "bg-[linear-gradient(135deg,rgba(34,211,238,0.92),rgba(236,72,153,0.88))] text-black",
                  (busy || (mode === "signup" && !pw.valid)) && "opacity-60 cursor-not-allowed"
                )}
              >
                {mode === "signup" ? "Create account" : "Sign in"}
              </button>

              {error ? <div className="text-sm text-red-300">{error}</div> : null}
            </form>

            <div className="mt-5 text-sm text-white/70">
              {mode === "signin" ? (
                <>
                  New to Edgaze?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMode("signup");
                    }}
                    className="font-semibold text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
                  >
                    Create account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMode("signin");
                    }}
                    className="font-semibold text-white hover:underline underline-offset-4"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>

            <div className="mt-5 text-xs text-white/45 leading-relaxed">
              By continuing, you agree to our{" "}
              <Link href="/terms" className="text-white/70 hover:text-white underline underline-offset-4">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-white/70 hover:text-white underline underline-offset-4">
                Privacy Policy
              </Link>
              .
            </div>
          </>
        )}

        {mode === "verify" && (
          <div className="mt-7 rounded-3xl bg-white/4 ring-1 ring-white/10 p-6">
            <div className="text-sm font-semibold text-white">Verify your email</div>
            <div className="mt-2 text-sm text-white/70">
              We sent a verification link to <span className="text-white/90">{email}</span>. Open it, then return here
              and sign in.
            </div>

            <button
              type="button"
              onClick={() => setMode("signin")}
              className="mt-6 w-full rounded-2xl py-3 text-sm font-semibold bg-[linear-gradient(135deg,rgba(34,211,238,0.92),rgba(236,72,153,0.88))] text-black hover:opacity-95 active:opacity-90"
            >
              I verified — go to sign in
            </button>

            <div className="mt-5 text-xs text-white/45 leading-relaxed">
              By continuing, you agree to our{" "}
              <Link href="/terms" className="text-white/70 hover:text-white underline underline-offset-4">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-white/70 hover:text-white underline underline-offset-4">
                Privacy Policy
              </Link>
              .
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

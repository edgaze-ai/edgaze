"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";

type Mode = "signin" | "signup" | "verify";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function passwordStrength(pw: string) {
  const rules = [
    { ok: pw.length >= 12, label: "12+ characters" },
    { ok: /[a-z]/.test(pw), label: "Lowercase" },
    { ok: /[A-Z]/.test(pw), label: "Uppercase" },
    { ok: /\d/.test(pw), label: "Number" },
    { ok: /[^a-zA-Z0-9]/.test(pw), label: "Symbol" },
  ];
  const score = rules.filter((r) => r.ok).length;
  return { score, valid: score === rules.length, rules };
}

/* =========================
   Left-side magic showcase
========================= */

function LeftShowcase() {
  const [scene, setScene] = useState<"prompt" | "workflow">("prompt");

  useEffect(() => {
    const id = setInterval(() => {
      setScene((s) => (s === "prompt" ? "workflow" : "prompt"));
    }, 4200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative h-full w-full rounded-[28px] border border-white/10 bg-[#0b0f14] overflow-hidden">
      {/* lighter ambient bg */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.18),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(236,72,153,0.16),transparent_50%)]" />
      <div className="absolute inset-0 bg-black/40" />

      <div className="relative z-10 p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="text-xs tracking-widest text-white/50 uppercase">
            Experience
          </div>
          <div className="mt-1 text-xl font-semibold text-white">
            Enter a code. Get value instantly.
          </div>
        </div>

        {/* Code Input */}
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.05] px-4 py-3">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm text-white/80">
            edgaze.ai/@handle/code
          </span>

          <span className="ml-auto flex items-center gap-1 rounded-lg border border-white/20 bg-black/40 px-3 py-1 text-xs font-mono text-white">
            {scene === "prompt" ? "HELLO" : "WORKFLOW"}
            <span className="ml-1 h-3 w-[1px] bg-white/80 animate-pulse" />
          </span>
        </div>

        {/* Scene area */}
        <div className="relative h-[260px] rounded-2xl border border-white/12 bg-white/[0.04] p-6 overflow-hidden">
          {/* Prompt scene */}
          <div
            className={cn(
              "absolute inset-0 p-6 transition-all duration-500",
              scene === "prompt"
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4 pointer-events-none"
            )}
          >
            <div className="text-sm font-semibold text-white mb-3">Prompt</div>

            <div className="rounded-xl border border-white/15 bg-black/50 p-4 text-sm leading-relaxed text-white/85">
              Write a welcome message for{" "}
              <span className="rounded-md border border-emerald-400/30 bg-emerald-400/15 px-2 py-0.5 text-emerald-300">
                {"{name}"}
              </span>{" "}
              in a{" "}
              <span className="rounded-md border border-emerald-400/30 bg-emerald-400/15 px-2 py-0.5 text-emerald-300">
                {"{tone}"}
              </span>{" "}
              style.
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-white/60">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Placeholders auto-detected and highlighted
            </div>
          </div>

          {/* Workflow scene */}
          <div
            className={cn(
              "absolute inset-0 p-6 transition-all duration-500",
              scene === "workflow"
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4 pointer-events-none"
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-white">Workflow</div>
              <div className="text-xs text-white/50">10 nodes · branching</div>
            </div>

            <div className="relative h-[190px] rounded-xl border border-white/15 bg-black/50 p-4 overflow-hidden">
              <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:40px_40px]" />

              <svg viewBox="0 0 100 60" className="absolute inset-0">
                <path
                  d="M10 30 C 30 10, 50 10, 70 30 C 80 40, 90 40, 95 30"
                  fill="none"
                  stroke="rgba(56,189,248,0.7)"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  className="animate-[dash_1.4s_linear_infinite]"
                />
                <path
                  d="M10 30 C 28 50, 48 52, 60 34 C 70 20, 82 20, 95 30"
                  fill="none"
                  stroke="rgba(255,255,255,0.18)"
                  strokeWidth="1"
                />
              </svg>

              {[
                { x: "10%", y: "50%", t: "Input" },
                { x: "30%", y: "32%", t: "Context" },
                { x: "38%", y: "56%", t: "Guard" },
                { x: "48%", y: "42%", t: "LLM" },
                { x: "62%", y: "52%", t: "Merge" },
                { x: "72%", y: "30%", t: "Tool" },
                { x: "80%", y: "56%", t: "Post" },
                { x: "90%", y: "44%", t: "Output" },
              ].map((n, i) => (
                <div
                  key={i}
                  className={cn(
                    "absolute -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/20 bg-white/[0.08] px-3 py-1.5 text-xs text-white shadow-[0_0_30px_rgba(56,189,248,0.10)]",
                    "animate-[float_5.2s_ease-in-out_infinite]"
                  )}
                  style={{
                    left: n.x,
                    top: n.y,
                    animationDelay: `${i * 120}ms`,
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
                    {n.t}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-white/60">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Fork. Remix. Ship in minutes.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 text-sm text-white/65">
          Discover prompts and workflows. Save time. Ship better.
        </div>
      </div>

      <style jsx>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -6;
          }
        }
        @keyframes float {
          0%,
          100% {
            transform: translate(-50%, -50%) translate(0px, 0px);
          }
          50% {
            transform: translate(-50%, -50%) translate(2px, -3px);
          }
        }
      `}</style>
    </div>
  );
}

/* =========================
   Modal
========================= */

export default function SignInModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);

  // reset state when opened (called from multiple places)
  useEffect(() => {
    if (!open) return;
    setMode("signin");
    setEmail("");
    setPassword("");
    setConfirm("");
    setFullName("");
    setError(null);
  }, [open]);

  const pw = useMemo(() => passwordStrength(password), [password]);

  const close = () => {
    setError(null);
    onClose();
  };

  if (!open) return null;

  async function doSignin() {
    setError(null);
    
    // Save current path before sign-in (in case it wasn't saved already)
    if (typeof window !== "undefined") {
      try {
        const currentPath = window.location.pathname + window.location.search + window.location.hash;
        if (currentPath && currentPath !== "/" && !currentPath.startsWith("/auth/")) {
          localStorage.setItem("edgaze:returnTo", currentPath);
          sessionStorage.setItem("edgaze:returnTo", currentPath);
        }
      } catch {}
    }
    
    await signInWithEmail(email, password);
    close();
    
    // The redirect will be handled by AuthContext's auth state change listener
    // No need to manually redirect here to avoid race conditions
  }

  async function doSignup() {
    setError(null);
    if (!pw.valid) throw new Error("Password is too weak.");
    if (password !== confirm) throw new Error("Passwords do not match.");

    await signUpWithEmail({
      email,
      password,
      fullName,
      handle: (email.split("@")[0] ?? "user").trim(),
    });

    setMode("verify");
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="w-full max-w-[1040px] overflow-hidden rounded-[34px] border border-white/12 bg-[#050505] shadow-[0_0_90px_rgba(56,189,248,0.16)]">
        <div className="h-1 w-full bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500" />

        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Left */}
          <div className="hidden md:block p-5">
            <LeftShowcase />
          </div>

          {/* Right */}
          <div className="p-6 md:p-9">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold tracking-wide text-white/60">
                  Welcome to the world of Edgaze
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {mode === "signin"
                    ? "Sign in"
                    : mode === "signup"
                    ? "Create your account"
                    : "Verify your email"}
                </div>
                <div className="mt-1 text-sm text-white/60">
                  {mode === "verify"
                    ? "Check your inbox and verify your email to continue."
                    : "Publish prompts and workflows under your handle."}
                </div>
              </div>

              <button
                onClick={close}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70 hover:bg-white/[0.07]"
              >
                Close
              </button>
            </div>

            {mode !== "verify" && (
              <>
                <button
                  onClick={() => {
                    setError(null);
                    signInWithGoogle().catch((e) => setError(e.message));
                  }}
                  className="mt-6 w-full rounded-2xl border border-white/12 bg-white text-black py-3 font-semibold shadow-[0_18px_55px_rgba(255,255,255,0.08)] hover:opacity-95 active:opacity-90"
                >
                  <span className="flex items-center justify-center gap-3">
                    <Image
                      src="/misc/google.png"
                      alt="Google"
                      width={18}
                      height={18}
                      priority
                    />
                    Continue with Google
                  </span>
                </button>

                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/10" />
                  <div className="text-xs text-white/45">or</div>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    (mode === "signup" ? doSignup() : doSignin()).catch((e) =>
                      setError(e.message)
                    );
                  }}
                  className="space-y-3"
                >
                  {mode === "signup" && (
                    <input
                      placeholder="Full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="input"
                      required
                    />
                  )}

                  <input
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    required
                    autoComplete="email"
                  />

                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                    required
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                  />

                  {mode === "signup" && (
                    <>
                      <input
                        type="password"
                        placeholder="Confirm password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        className="input"
                        required
                        autoComplete="new-password"
                      />

                      <div className="mt-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-white/55">
                            Password strength
                          </div>
                          <div className="text-xs text-white/55">
                            {pw.score}/5
                          </div>
                        </div>

                        <div className="mt-2 grid grid-cols-5 gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div
                              key={i}
                              className={cn(
                                "h-1 rounded-full",
                                pw.score > i
                                  ? "bg-emerald-400/80"
                                  : "bg-white/10"
                              )}
                            />
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

                  <button className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 py-3 text-black font-semibold hover:opacity-95 active:opacity-90">
                    {mode === "signup" ? "Create account" : "Sign in"}
                  </button>

                  {error && <p className="text-sm text-red-400">{error}</p>}
                </form>

                {/* Premium hyperlink signup */}
                <div className="mt-5 text-sm text-white/70">
                  New to Edgaze?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      close(); // closes modal + clears error
                      router.push("/apply");
                    }}
                    className="font-semibold text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
                  >
                    Create account
                  </button>
                </div>

                {mode === "signup" && (
                  <div className="mt-2 text-sm text-white/70">
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
                  </div>
                )}
              </>
            )}

            {mode === "verify" && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="text-sm font-semibold text-white/90">
                  Verify your email
                </div>
                <div className="mt-2 text-sm text-white/60">
                  We sent a verification link to{" "}
                  <span className="text-white">{email}</span>. Open it to
                  activate your account, then return and sign in.
                </div>

                <button
                  onClick={() => setMode("signin")}
                  className="mt-5 w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 py-3 text-black font-semibold hover:opacity-95 active:opacity-90"
                >
                  I verified, take me to sign in
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          padding: 12px 14px;
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: white;
        }
        .input:focus {
          outline: none;
          border-color: rgba(56, 189, 248, 0.7);
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.12);
        }
      `}</style>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [step, setStep] = useState<"loading" | "form" | "success" | "error">(
    "loading"
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pw = useMemo(() => passwordStrength(password), [password]);

  const handleRecovery = useCallback(
    async (code?: string | null) => {
      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError(exchangeError.message);
          setStep("error");
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setStep("form");
      } else {
        setError("Invalid or expired reset link. Please request a new one.");
        setStep("error");
      }
    },
    [supabase]
  );

  useEffect(() => {
    const code = searchParams.get("code");
    const hashParams = typeof window !== "undefined" ? window.location.hash : "";

    const run = async () => {
      if (code) {
        await handleRecovery(code);
        return;
      }

      if (hashParams) {
        await new Promise((r) => setTimeout(r, 500));
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          setStep("form");
        } else {
          await handleRecovery(null);
        }
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setStep("form");
      } else {
        setError("Invalid or expired reset link. Please request a new one.");
        setStep("error");
      }
    };

    const { data } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStep("form");
      }
    });

    void run();
    return () => data.subscription.unsubscribe();
  }, [searchParams, supabase, handleRecovery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!pw.valid) {
      setError("Password is too weak. Please meet all requirements.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setStep("success");
  };

  if (step === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] px-6">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] px-6">
        <div className="w-full max-w-md rounded-3xl border border-white/12 bg-white/[0.03] p-6 text-center">
          <div className="text-xl font-semibold text-red-400">
            Reset link invalid
          </div>
          <p className="mt-3 text-sm text-white/60">{error}</p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-6 py-3 text-black font-semibold hover:opacity-95"
          >
            Go to home
          </Link>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] px-6">
        <div className="w-full max-w-md rounded-3xl border border-white/12 bg-white/[0.03] p-6 text-center">
          <div className="text-2xl font-semibold text-emerald-400">
            Password updated
          </div>
          <p className="mt-3 text-sm text-white/60">
            You can now sign in with your new password.
          </p>
          <Link
            href="/marketplace"
            className="mt-6 inline-block rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 px-6 py-3 text-black font-semibold hover:opacity-95"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] px-6">
      <div className="w-full max-w-md rounded-3xl border border-white/12 bg-white/[0.03] p-6">
        <div className="text-2xl font-semibold text-white">
          Set new password
        </div>
        <p className="mt-2 text-sm text-white/60">
          Enter your new password below.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            required
            autoComplete="new-password"
          />

          <input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input"
            required
            autoComplete="new-password"
          />

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between text-xs text-white/55">
              <span>Password strength</span>
              <span>{pw.score}/5</span>
            </div>
            <div className="mt-2 flex gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full",
                    pw.score > i ? "bg-emerald-400/80" : "bg-white/10"
                  )}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {pw.rules.map((r) => (
                <span
                  key={r.label}
                  className={cn(
                    "rounded px-2 py-0.5 text-[11px]",
                    r.ok
                      ? "border border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                      : "border border-white/10 bg-white/[0.03] text-white/55"
                  )}
                >
                  {r.label}
                </span>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={!pw.valid || password !== confirm}
            className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 py-3 font-semibold text-black hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Update password
          </button>
        </form>

        <Link
          href="/"
          className="mt-4 block text-center text-sm text-white/60 hover:text-white"
        >
          Back to home
        </Link>
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
      `}      </style>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#050505]">
          <div className="text-white/60">Loading...</div>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useAuth } from "@/components/auth/AuthContext";
import { DEFAULT_AVATAR_SRC } from "@/config/branding";

type ValidateOk = {
  valid: true;
  invite: {
    profile_id: string;
    open_claim?: boolean;
    target_email_masked: string | null;
    creator_name: string;
    creator_photo_url: string | null;
    custom_message: string;
    handle: string;
    banner_url: string | null;
    expires_at: string;
  };
};

export default function ClaimPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { authReady, getAccessToken, userId } = useAuth();

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [invite, setInvite] = useState<ValidateOk["invite"] | null>(null);

  const [mode, setMode] = useState<"signup" | "signin">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [completeErr, setCompleteErr] = useState<string | null>(null);
  /** Single shared completion promise so email submit + useEffect + Google return never double-POST. */
  const claimInFlightRef = useRef<Promise<void> | null>(null);
  /** Stop auto-retry loops when completion fails (user stays signed in). */
  const claimTerminalFailureRef = useRef(false);

  const runValidate = useCallback(async () => {
    claimTerminalFailureRef.current = false;
    claimInFlightRef.current = null;
    setLoading(true);
    setReason(null);
    try {
      const res = await fetch(`/api/claim/${encodeURIComponent(token)}/validate`);
      const data = await res.json();
      if (!data.valid) {
        setValid(false);
        setReason(data.reason || "invalid");
        if (data.invite && data.reason === "already_claimed") {
          const inv = data.invite as { handle?: string; full_name?: string | null };
          setInvite({
            profile_id: "",
            open_claim: false,
            target_email_masked: null,
            creator_name: inv.full_name ?? inv.handle ?? "",
            creator_photo_url: null,
            custom_message: "",
            handle: inv.handle || "",
            banner_url: null,
            expires_at: "",
          });
        }
        return;
      }
      setValid(true);
      setInvite(data.invite);
    } catch {
      setValid(false);
      setReason("invalid");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void runValidate();
  }, [runValidate]);

  const tryCompleteClaim = useCallback((): Promise<void> => {
    if (!token || !valid) return Promise.resolve();

    const existing = claimInFlightRef.current;
    if (existing) return existing;

    const p = (async () => {
      try {
        setCompleteErr(null);
        const access = await getAccessToken();
        if (!access) return;

        const res = await fetch(`/api/claim/${encodeURIComponent(token)}/complete`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${access}`,
          },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          claimTerminalFailureRef.current = true;
          if (data.error === "email_mismatch" || data.error === "identity_mismatch") {
            setCompleteErr(data.message || "This account does not match this claim link.");
            return;
          }
          if (
            res.status === 409 &&
            (data.error === "already_claimed" ||
              data.error === "Link is no longer active" ||
              data.error === "Workspace already claimed")
          ) {
            setCompleteErr(
              data.message ||
                "Someone else already used this link, or the workspace is no longer available.",
            );
            return;
          }
          throw new Error(data.error || data.message || `HTTP ${res.status}`);
        }
        router.replace(`/creators/onboarding`);
      } catch (e: any) {
        claimTerminalFailureRef.current = true;
        setCompleteErr(e?.message || "Could not complete claim");
      }
    })();

    claimInFlightRef.current = p;
    void p.finally(() => {
      if (claimInFlightRef.current === p) {
        claimInFlightRef.current = null;
      }
    });

    return p;
  }, [getAccessToken, router, token, valid]);

  useEffect(() => {
    if (!authReady || !valid || !userId || claimTerminalFailureRef.current) return;
    void tryCompleteClaim();
  }, [authReady, valid, userId, tryCompleteClaim]);

  const handleGoogle = async () => {
    setAuthBusy(true);
    setAuthErr(null);
    claimTerminalFailureRef.current = false;
    try {
      const { error: e } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/claim/${encodeURIComponent(token)}`,
          // Avoid a stuck Google session picking the wrong account; PKCE + full redirect still apply.
          queryParams: { prompt: "select_account" },
        },
      });
      if (e) throw e;
    } catch (err: any) {
      setAuthErr(err?.message || "Google sign-in failed");
      setAuthBusy(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    setAuthErr(null);
    setCompleteErr(null);
    claimTerminalFailureRef.current = false;
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/claim/${encodeURIComponent(token)}`,
          },
        });
        if (signUpError) throw signUpError;
        if (!data.user) throw new Error("Signup failed");
        if (data.session) {
          await tryCompleteClaim();
        } else {
          setAuthErr("Check your email to confirm, then return to this page to finish claiming.");
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        if (!data.session) throw new Error("Sign in failed");
        await tryCompleteClaim();
      }
    } catch (err: any) {
      setAuthErr(err?.message || "Authentication failed");
    } finally {
      setAuthBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white/60">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] px-4 text-center text-white">
        <AlertCircle className="h-10 w-10 text-amber-400 mb-4" />
        {reason === "already_claimed" && invite?.handle ? (
          <p className="text-sm text-white/45 mb-1">
            @{invite.handle}
            {invite.creator_name ? ` · ${invite.creator_name}` : ""}
          </p>
        ) : null}
        <h1 className="text-xl font-semibold">
          {reason === "expired"
            ? "This claim link has expired"
            : reason === "already_claimed"
              ? "This workspace is already claimed"
              : reason === "consumed"
                ? "This link was already used"
                : reason === "revoked"
                  ? "This link was revoked"
                  : "Invalid or unknown link"}
        </h1>
        <p className="mt-2 text-sm text-white/55 max-w-md">
          {reason === "already_claimed"
            ? "Sign in with the account that claimed this workspace, or contact Edgaze support."
            : "Request a new link from your contact at Edgaze or reach out to support."}
        </p>
      </div>
    );
  }

  if (!invite) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex min-h-screen items-center justify-center bg-[#050505] px-4 py-10"
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/[0.08] bg-black/50 p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative h-20 w-20 rounded-full overflow-hidden border border-white/15 mb-3">
            <Image
              src={invite.creator_photo_url || DEFAULT_AVATAR_SRC}
              alt=""
              fill
              className="object-cover"
              sizes="80px"
            />
          </div>
          <h1 className="text-2xl font-bold text-white">{invite.creator_name}</h1>
          <p className="text-sm text-white/45">@{invite.handle}</p>
          <p className="mt-3 text-sm text-white/60 leading-relaxed">{invite.custom_message}</p>
          {!invite.open_claim && invite.target_email_masked ? (
            <p className="mt-2 text-xs text-white/40">
              Reserved for <span className="text-cyan-200/90">{invite.target_email_masked}</span>
            </p>
          ) : null}
        </div>

        {completeErr && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            {completeErr}
          </div>
        )}

        {authErr && (
          <div className="mb-4 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {authErr}
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleGoogle()}
          disabled={authBusy}
          className="mb-6 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] py-3.5 text-sm font-semibold text-white hover:bg-white/[0.07] disabled:opacity-50"
        >
          Continue with Google
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[11px] text-white/40">or email</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="flex rounded-xl border border-white/10 p-0.5 mb-4">
          <button
            type="button"
            className={`flex-1 rounded-lg py-2 text-xs font-semibold ${
              mode === "signin" ? "bg-white text-black" : "text-white/60"
            }`}
            onClick={() => setMode("signin")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg py-2 text-xs font-semibold ${
              mode === "signup" ? "bg-white text-black" : "text-white/60"
            }`}
            onClick={() => setMode("signup")}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-white/55">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-3 text-sm text-white"
                placeholder="you@example.com"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/55">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-10 text-sm text-white"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={authBusy}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 py-3 text-sm font-semibold text-black disabled:opacity-50"
          >
            {authBusy ? (
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            ) : mode === "signup" ? (
              "Create & claim"
            ) : (
              "Sign in & claim"
            )}
          </button>
        </form>

        <p className="mt-6 text-[11px] text-center text-white/35 leading-relaxed">
          {invite.open_claim || !invite.target_email_masked
            ? "Sign in with the Google or email account you want to use for this workspace."
            : "Use the same email as your invite. If you use another account, claiming will not succeed."}
        </p>
      </div>
    </motion.div>
  );
}

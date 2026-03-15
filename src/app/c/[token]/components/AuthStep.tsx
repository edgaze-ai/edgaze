"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

interface AuthStepProps {
  creatorName: string;
  creatorPhotoUrl: string;
  inviteToken: string;
  onSuccess: (userId: string) => void;
}

export default function AuthStep({
  creatorName,
  creatorPhotoUrl,
  inviteToken,
  onSuccess,
}: AuthStepProps) {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createSupabaseBrowserClient();

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/c/${inviteToken}`,
        },
      });

      if (signInError) throw signInError;
    } catch (err: any) {
      setError(err.message || "Authentication failed");
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/c/${inviteToken}`,
          },
        });

        if (signUpError) throw signUpError;
        if (!data.user) throw new Error("Signup failed");

        const userId = data.user.id;

        // Claim the invite
        const claimResponse = await fetch(
          `/api/invite-token/${encodeURIComponent(inviteToken)}/claim`,
          {
            method: "POST",
          },
        );

        if (!claimResponse.ok) {
          throw new Error("Failed to claim invite");
        }

        onSuccess(userId);
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
        if (!data.user) throw new Error("Sign in failed");

        onSuccess(data.user.id);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="flex min-h-screen items-center justify-center px-4 py-4 sm:py-8"
    >
      <div className="w-full max-w-md">
        {/* Premium Glass Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-black/40 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-2xl sm:rounded-3xl sm:p-8"
        >
          {/* Ambient glow */}
          <div className="absolute -inset-20 bg-gradient-to-r from-cyan-400/10 via-sky-500/10 to-pink-500/10 blur-3xl" />

          {/* Content */}
          <div className="relative z-10">
            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-6 text-center sm:mb-8"
            >
              <h2 className="mb-2 text-2xl font-bold text-white sm:text-3xl">
                {mode === "signup" ? "Create your account" : "Welcome back"}
              </h2>
              <p className="text-xs text-white/50 sm:text-sm">
                {mode === "signup" ? "Join Edgaze and start creating" : "Sign in to continue"}
              </p>
            </motion.div>

            {/* Google Sign In Button */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="group relative mb-6 w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-3.5 backdrop-blur-sm transition-all hover:border-white/[0.12] hover:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-center gap-3">
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="text-base font-medium text-white">Continue with Google</span>
              </div>
            </motion.button>

            {/* Divider */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mb-6 flex items-center gap-4"
            >
              <div className="h-[1px] flex-1 bg-white/[0.08]" />
              <span className="text-xs text-white/40">or continue with email</span>
              <div className="h-[1px] flex-1 bg-white/[0.08]" />
            </motion.div>

            {/* Email Form */}
            <motion.form
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              onSubmit={handleEmailAuth}
              className="space-y-4"
            >
              {/* Email Input */}
              <div>
                <label className="mb-2 block text-sm font-medium text-white/70">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-3 pl-12 pr-4 text-white placeholder:text-white/30 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/50 backdrop-blur-sm"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="mb-2 block text-sm font-medium text-white/70">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-3 pl-12 pr-12 text-white placeholder:text-white/30 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/50 backdrop-blur-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                >
                  {error}
                </motion.div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-pink-500 py-3.5 text-base font-semibold text-black shadow-[0_0_20px_rgba(56,189,248,0.3)] transition-all hover:shadow-[0_0_28px_rgba(56,189,248,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" />
                <span className="relative">
                  {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
                </span>
              </button>
            </motion.form>

            {/* Toggle mode */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="mt-6 text-center text-sm"
            >
              <span className="text-white/50">
                {mode === "signup" ? "Already have an account?" : "Don't have an account?"}
              </span>{" "}
              <button
                onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                className="font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {mode === "signup" ? "Sign in" : "Sign up"}
              </button>
            </motion.div>
          </div>
        </motion.div>

        {/* Terms */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-6 text-center text-xs text-white/30"
        >
          By continuing, you agree to Edgaze&apos;s{" "}
          <a
            href="/docs/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 transition-colors underline"
          >
            Terms of Service
          </a>{" "}
          and{" "}
          <a
            href="/docs/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 transition-colors underline"
          >
            Privacy Policy
          </a>
        </motion.p>
      </div>
    </motion.div>
  );
}

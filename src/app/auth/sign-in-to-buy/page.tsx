"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { track } from "@/lib/mixpanel";

const RETURN_KEY = "edgaze:returnTo";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Listing = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  price_usd: number | null;
  owner_handle: string;
  owner_name?: string | null;
  edgaze_code: string;
  type: "prompt" | "workflow";
};

export default function SignInToBuyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();

  const returnPath = searchParams.get("return") || "";
  const typeParam = searchParams.get("type") || "prompt";

  const [listing, setListing] = useState<Listing | null>(null);
  const [listingLoading, setListingLoading] = useState(true);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Build redirect URL with action=purchase so product page auto-triggers checkout
  const redirectUrl = useMemo(() => {
    if (!returnPath || returnPath === "/" || returnPath.startsWith("/auth/")) return null;
    const base = returnPath.split("?")[0];
    const params = new URLSearchParams(returnPath.includes("?") ? returnPath.split("?")[1] : "");
    params.set("action", "purchase");
    return `${base}?${params.toString()}`;
  }, [returnPath]);

  // If already signed in, redirect to product page with action=purchase
  useEffect(() => {
    if (!userId || !redirectUrl) return;
    try {
      sessionStorage.setItem("edgaze:actionIntentAt", String(Date.now()));
      sessionStorage.setItem("edgaze:actionIntentPath", returnPath.split("?")[0] ?? "");
    } catch {}
    router.replace(redirectUrl);
  }, [userId, redirectUrl, router, returnPath]);

  // Save return path so OAuth callback sends user back with action=purchase
  useEffect(() => {
    if (!redirectUrl) return;
    try {
      localStorage.setItem(RETURN_KEY, redirectUrl);
      sessionStorage.setItem(RETURN_KEY, redirectUrl);
    } catch {}
  }, [redirectUrl]);

  // Fetch listing for product preview (pathname only — query params break path parsing)
  const pathForListing = useMemo(() => {
    if (!returnPath) return "";
    const pathname = (returnPath.split("?")[0] ?? "").split("#")[0]?.trim() ?? "";
    return pathname.startsWith("/") ? pathname : `/${pathname}`;
  }, [returnPath]);

  useEffect(() => {
    if (!pathForListing || pathForListing === "/") {
      setListingLoading(false);
      return;
    }
    let cancelled = false;
    const url = `/api/listing/by-path?path=${encodeURIComponent(pathForListing)}`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.listing) setListing(data.listing);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setListingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pathForListing]);

  const handleGoogle = () => {
    setError(null);
    track("Sign In To Buy - Google Clicked", {
      return_path: returnPath,
      surface: "sign_in_to_buy",
    });
    signInWithGoogle(redirectUrl ?? undefined).catch((e) =>
      setError(e?.message ?? "Sign-in failed"),
    );
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (mode === "signup") {
        if (password !== confirm) throw new Error("Passwords do not match");
        await signUpWithEmail({
          email,
          password,
          fullName: fullName || email.split("@")[0] || "User",
          handle: (email.split("@")[0] ?? "user").trim().slice(0, 24),
        });
        track("Sign In To Buy - Sign Up Submitted", {
          return_path: returnPath,
          surface: "sign_in_to_buy",
        });
      } else {
        await signInWithEmail(email, password);
        track("Sign In To Buy - Email Sign In", {
          return_path: returnPath,
          surface: "sign_in_to_buy",
        });
      }
      if (redirectUrl) {
        try {
          sessionStorage.setItem("edgaze:actionIntentAt", String(Date.now()));
          sessionStorage.setItem("edgaze:actionIntentPath", returnPath.split("?")[0] ?? "");
        } catch {}
        router.replace(redirectUrl);
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    }
  };

  if (!returnPath) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
        <p className="text-white/60 mb-4">
          Missing return path. Go back to the product and try again.
        </p>
        <Link href="/marketplace" className="text-cyan-400 hover:text-cyan-300 font-medium">
          Browse marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-y-auto overflow-x-hidden">
      {/* Gradient orbs — fixed so they don't create scroll */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-[0]">
        <div className="absolute top-0 left-0 w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] rounded-full bg-cyan-500/20 blur-[120px] -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute top-1/3 right-0 w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] rounded-full bg-pink-500/15 blur-[100px] translate-x-1/3" />
        <div className="absolute bottom-0 left-1/3 w-[50vw] h-[50vw] max-w-[400px] max-h-[400px] rounded-full bg-cyan-500/10 blur-[80px] -translate-x-1/2 translate-y-1/3" />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row md:min-h-screen md:justify-center md:items-center md:gap-8 lg:gap-10 p-4 sm:p-6 md:p-8">
        {/* Centered wrapper: preview + sign-in close together */}
        <div className="flex flex-col md:flex-row w-full max-w-4xl md:max-w-none md:w-auto md:items-stretch gap-6 md:gap-8 lg:gap-10">
          {/* Preview left (desktop) / below sign-in (mobile order-2) */}
          <div className="flex flex-col justify-center order-2 md:order-1 w-full md:w-[380px] lg:w-[420px] shrink-0 md:border-r border-white/5 md:pr-8 lg:pr-10">
            <div className="w-full max-w-md mx-auto md:mx-0">
              <div className="rounded-xl md:rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden shadow-[0_0_60px_rgba(34,211,238,0.08)]">
                <div className="h-1 w-full bg-gradient-to-r from-cyan-400 via-pink-400 to-cyan-400" />
                <div className="p-2.5 md:p-6 lg:p-8">
                  {listingLoading ? (
                    <div className="flex md:block gap-3 md:gap-0">
                      <div className="w-16 h-16 md:w-full md:aspect-video shrink-0 rounded-lg md:rounded-xl bg-white/5 animate-pulse md:mb-5" />
                      <div className="flex-1 min-w-0 md:contents">
                        <div className="h-3 md:h-4 w-3/4 bg-white/10 rounded animate-pulse mb-2 md:mb-1" />
                        <div className="h-3 w-1/2 bg-white/5 rounded animate-pulse" />
                      </div>
                    </div>
                  ) : listing ? (
                    <>
                      {/* Mobile: horizontal strip (thumb + title + creator + price). Desktop: stacked card */}
                      <div className="flex md:block gap-3 md:gap-0">
                        <div className="relative shrink-0 w-16 h-16 md:w-full md:aspect-video rounded-lg md:rounded-xl overflow-hidden bg-white/5">
                          {listing.thumbnail_url ? (
                            <Image
                              src={listing.thumbnail_url}
                              alt={listing.title}
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 64px, (max-width: 1024px) 45vw, 420px"
                              priority
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-2xl md:text-4xl opacity-40">
                                {listing.type === "workflow" ? "⚡" : "✨"}
                              </span>
                            </div>
                          )}
                          <div className="absolute bottom-0.5 right-0.5 md:bottom-2 md:right-2 rounded bg-black/70 px-1 py-0.5 md:px-2 md:py-1 text-[9px] md:text-xs font-medium text-white">
                            {listing.type === "workflow" ? "Workflow" : "Prompt"}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <h1 className="text-sm md:text-xl font-semibold text-white line-clamp-2">
                            {listing.title}
                          </h1>
                          <p className="text-[11px] md:text-sm text-white/50 mt-0.5">
                            {listing.owner_name ? (
                              <>
                                <span>{listing.owner_name}</span>{" "}
                                <span className="text-white/40">@{listing.owner_handle}</span>
                              </>
                            ) : (
                              `@${listing.owner_handle}`
                            )}
                          </p>
                          {listing.price_usd != null && listing.price_usd > 0 && (
                            <p className="text-xs md:text-lg font-semibold bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent mt-1 md:mt-2">
                              ${Number(listing.price_usd).toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Description only on desktop (md+) to keep mobile tiny */}
                      {listing.description && (
                        <p className="text-sm text-white/60 line-clamp-3 mt-3 md:mt-4 hidden md:block">
                          {listing.description}
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center py-6 md:py-12">
                      <p className="text-white/50 text-xs md:text-sm">Product preview</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sign-in right (desktop) / first on mobile (order-1) */}
          <div className="flex flex-col justify-center order-1 md:order-2 w-full md:w-[380px] lg:w-[420px] shrink-0 md:pl-0">
            <div className="max-w-md w-full mx-auto md:mx-0">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-6 md:mb-8 transition"
              >
                <Image
                  src="/brand/edgaze-mark.png"
                  alt="Edgaze"
                  width={24}
                  height={24}
                  className="h-6 w-auto"
                />
                <span className="font-semibold">Edgaze</span>
              </Link>

              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                Sign in to complete your purchase
              </h2>
              <p className="text-white/70 text-base md:text-lg mb-6 md:mb-8 leading-relaxed">
                Sign in so we can attribute this purchase to your account and you can come back and
                use it anytime.
              </p>

              <button
                type="button"
                onClick={handleGoogle}
                className="w-full rounded-2xl border border-white/15 bg-white text-black py-3.5 font-semibold flex items-center justify-center gap-3 hover:bg-white/95 transition shadow-lg"
              >
                <Image src="/misc/google.png" alt="" width={20} height={20} />
                Continue with Google
              </button>

              <div className="my-5 md:my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/15" />
                <span className="text-xs text-white/45">or</span>
                <div className="h-px flex-1 bg-white/15" />
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-4">
                {mode === "signup" && (
                  <input
                    type="text"
                    placeholder="Full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                    autoComplete="name"
                  />
                )}
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                  required
                  autoComplete="email"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                  required
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
                {mode === "signup" && (
                  <input
                    type="password"
                    placeholder="Confirm password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                    required
                    autoComplete="new-password"
                  />
                )}
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button
                  type="submit"
                  className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 via-cyan-400 to-pink-500 py-3.5 font-semibold text-black hover:opacity-95 transition shadow-[0_0_30px_rgba(34,211,238,0.25)]"
                >
                  {mode === "signin" ? "Sign in" : "Create account"}
                </button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setMode((m) => (m === "signin" ? "signup" : "signin"));
                  setError(null);
                }}
                className="mt-4 w-full text-sm text-white/55 hover:text-cyan-400 transition"
              >
                {mode === "signin"
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Sign in"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// src/app/auth/callback/CallbackClient.tsx
"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

function safeReturnTo(path: string) {
  if (!path || typeof path !== "string") return "/marketplace";
  if (!path.startsWith("/")) return "/marketplace";
  if (path.startsWith("//")) return "/marketplace";
  if (path.includes("http://") || path.includes("https://")) return "/marketplace";
  return path;
}

function readReturnTo() {
  try {
    const v = localStorage.getItem("edgaze:returnTo");
    localStorage.removeItem("edgaze:returnTo");
    return safeReturnTo(v || "/marketplace");
  } catch {
    return "/marketplace";
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function CallbackClient() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  useEffect(() => {
    const run = async () => {
      const returnTo = readReturnTo();
      const code = params.get("code");

      // 1) If already signed in, leave immediately (common when Supabase auto-detects URL)
      const existing = await supabase.auth.getSession();
      if (existing.data.session) {
        router.replace(returnTo);
        return;
      }

      // 2) If no code, nothing to exchange. Just go back.
      if (!code) {
        router.replace(returnTo);
        return;
      }

      // 3) Try exchange. If it fails due to missing code_verifier, fallback to session read.
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        router.replace(returnTo);
        return;
      }

      // Fallback: sometimes auth listener processes URL but exchangeCodeForSession errors
      // Give it a brief moment then check session again.
      await sleep(250);
      const again = await supabase.auth.getSession();

      if (again.data.session) {
        router.replace(returnTo);
        return;
      }

      // Absolute last resort: go home (still silent)
      router.replace("/marketplace");
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // render nothing, ever
  return null;
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { useAuth } from "../auth/AuthContext";

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { userId, authReady } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!authReady) return;
      if (!userId) {
        router.replace("/marketplace");
        return;
      }

      setChecking(true);

      const { data, error } = await supabase
        .from("admin_roles")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!alive) return;

      if (error || !data) {
        setIsAdmin(false);
        setChecking(false);
        router.replace(`/forbidden?from=${encodeURIComponent(pathname || "/admin")}`);
        return;
      }

      setIsAdmin(true);
      setChecking(false);
    }

    run();

    return () => {
      alive = false;
    };
  }, [authReady, pathname, router, supabase, userId]);

  if (!authReady || checking) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#070708]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-9 w-9 rounded-xl border border-white/[0.08] bg-white/[0.04] flex items-center justify-center">
            <div className="h-4 w-4 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
          </div>
          <p className="text-[13px] font-medium text-white/60">Checking access…</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return <>{children}</>;
}

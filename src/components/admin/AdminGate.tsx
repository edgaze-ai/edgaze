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
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-sm text-white/70">Checking access…</div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return <>{children}</>;
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import MaintenanceScreen from "./MaintenanceScreen";

const SKIP_PATHS = new Set(["/"]);
const SKIP_PREFIX = "/admin";

function useMaintenanceMode() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    let alive = true;

    async function fetchMaintenance() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "maintenance_mode")
          .maybeSingle();

        if (!alive) return;
        if (error) {
          setMaintenance(false);
          return;
        }
        setMaintenance(Boolean((data as { value?: boolean } | null)?.value));
      } finally {
        if (alive) setLoading(false);
      }
    }

    fetchMaintenance();

    const ch = supabase
      .channel("realtime:app_settings:maintenance_mode")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_settings",
          filter: "key=eq.maintenance_mode",
        },
        (payload: { new?: { value?: boolean } }) => {
          const next = Boolean(payload?.new?.value);
          setMaintenance(next);
        }
      )
      .subscribe();

    return () => {
      alive = false;
      try {
        supabase.removeChannel(ch);
      } catch {}
    };
  }, [supabase]);

  return { loading, maintenance };
}

export default function MaintenanceGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const { loading, maintenance } = useMaintenanceMode();

  const skip =
    SKIP_PATHS.has(pathname) || pathname.startsWith(SKIP_PREFIX);

  if (skip) {
    return <>{children}</>;
  }

  if (loading) {
    return <div className="min-h-screen bg-[#0b0b0b]" />;
  }

  if (maintenance) {
    return <MaintenanceScreen />;
  }

  return <>{children}</>;
}

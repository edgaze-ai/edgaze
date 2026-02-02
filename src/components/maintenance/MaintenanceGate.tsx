"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import MaintenanceScreen from "./MaintenanceScreen";

const SKIP_PATHS = new Set(["/"]);
const SKIP_PREFIX = "/admin";

function useMaintenanceMode() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    let alive = true;

    async function fetchMaintenance() {
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
      } catch {
        if (alive) setMaintenance(false);
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

  return { maintenance };
}

export default function MaintenanceGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const { maintenance } = useMaintenanceMode();

  const skip =
    SKIP_PATHS.has(pathname) || pathname.startsWith(SKIP_PREFIX);

  // Never block: always render app immediately. Check maintenance in background.
  // When maintenance is on, overlay the maintenance screen on top.
  if (skip) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      {maintenance ? <MaintenanceScreen /> : null}
    </>
  );
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabase/browser";
import { useAuth } from "../../components/auth/AuthContext";

type ModRow = {
  is_banned: boolean;
  ban_reason: string | null;
  banned_at: string | null;
  ban_expires_at: string | null;
};

function fmt(ts: string | null) {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function BannedPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { userId, authReady, signOut } = useAuth();

  const [loading, setLoading] = useState(true);
  const [mod, setMod] = useState<ModRow | null>(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!authReady) return;
      if (!userId) {
        setLoading(false);
        setMod(null);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from("user_moderation")
        .select("is_banned,ban_reason,banned_at,ban_expires_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (!alive) return;

      if (error) {
        setMod(null);
        setLoading(false);
        return;
      }

      setMod((data as any as ModRow) ?? null);
      setLoading(false);
    }

    run();

    return () => {
      alive = false;
    };
  }, [authReady, supabase, userId]);

  const isStillBanned = (() => {
    if (!mod?.is_banned) return false;
    if (!mod.ban_expires_at) return true;
    return new Date(mod.ban_expires_at).getTime() > Date.now();
  })();

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="text-lg font-semibold">Account restricted</div>

        {loading ? (
          <div className="text-sm text-white/60 mt-2">Loading…</div>
        ) : !userId ? (
          <div className="text-sm text-white/60 mt-2">
            You are not signed in.
          </div>
        ) : !isStillBanned ? (
          <>
            <div className="text-sm text-white/60 mt-2">
              Your ban appears to have expired. Sign out and sign back in if you still can’t post.
            </div>
            <button
              onClick={() => signOut()}
              className="mt-4 text-sm px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <div className="text-sm text-white/60 mt-2">
              You can still browse public pages, but posting, liking, and publishing are disabled.
            </div>

            {mod?.ban_reason ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-xs text-white/50">Reason</div>
                <div className="text-sm mt-1 whitespace-pre-wrap">{mod.ban_reason}</div>
              </div>
            ) : null}

            <div className="mt-3 text-xs text-white/50 space-y-1">
              {mod?.banned_at ? <div>Banned at: {fmt(mod.banned_at)}</div> : null}
              {mod?.ban_expires_at ? <div>Expires: {fmt(mod.ban_expires_at)}</div> : <div>Expires: never</div>}
            </div>

            <div className="flex items-center gap-2 mt-4">
              <a
                href="/marketplace"
                className="text-sm px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
              >
                Back to marketplace
              </a>
              <button
                onClick={() => signOut()}
                className="text-sm px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

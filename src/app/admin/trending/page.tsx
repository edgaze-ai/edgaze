"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { useAuth } from "../../../components/auth/AuthContext";
import type { TrendingAdminRow } from "../../../lib/trending/admin-public-types";

type DisqualifiedRow = {
  id: string;
  title: string | null;
  edgaze_code: string | null;
  owner_handle: string | null;
  owner_name: string | null;
  thumbnail_url: string | null;
  updated_at: string | null;
  visibility?: string | null;
  type?: string | null;
  is_published?: boolean | null;
};

type ApiPayload = {
  trending_workflows: TrendingAdminRow[];
  trending_prompts: TrendingAdminRow[];
  disqualified_workflows: DisqualifiedRow[];
  disqualified_prompts: DisqualifiedRow[];
};

function cn(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

function listingHref(
  kind: "workflow" | "prompt",
  handle: string | null | undefined,
  code: string | null | undefined,
) {
  const h = (handle || "").replace(/^@/, "");
  const c = code || "";
  if (!h || !c) return null;
  return kind === "workflow" ? `/${h}/${c}` : `/p/${h}/${c}`;
}

const th = "text-left text-[11px] font-semibold uppercase tracking-wider text-white/45 pb-2 pr-4";
const td = "py-3 pr-4 text-[13px] text-white/85 align-top border-t border-white/[0.06]";
const card =
  "rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset]";

function TrendingTable({
  title,
  rows,
  kind,
  busyId,
  onDisqualify,
}: {
  title: string;
  rows: TrendingAdminRow[];
  kind: "workflow" | "prompt";
  busyId: string | null;
  onDisqualify: (listingType: "workflow" | "prompt", listingId: string) => void;
}) {
  return (
    <section className={cn(card, "p-5 sm:p-6")}>
      <h2 className="text-sm font-semibold text-white/90 mb-4">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-[13px] text-white/50">
          No listings in this slot (filters may exclude all).
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                <th className={th}>Listing</th>
                <th className={th}>Runs (7d)</th>
                <th className={th}>Views (rank)</th>
                <th className={th}>Auto thumb</th>
                <th className={th}>Code</th>
                <th className={th}>Link</th>
                <th className={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const href = listingHref(kind, row.owner_handle, row.edgaze_code);
                const id = `${kind}:${row.id}`;
                const busy = busyId === id;
                return (
                  <tr key={row.id}>
                    <td className={td}>
                      <div className="font-medium text-white/95">{row.title || "—"}</div>
                      <div className="mt-0.5 text-[12px] text-white/50">
                        {row.owner_name || "—"}{" "}
                        {row.owner_handle ? (
                          <span className="text-white/40">
                            @{row.owner_handle.replace(/^@/, "")}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className={cn(td, "tabular-nums")}>{row.weekly_runs}</td>
                    <td className={cn(td, "tabular-nums")}>{row.week_views_for_rank}</td>
                    <td className={td}>{row.thumbnail_auto_generated === true ? "Yes" : "No"}</td>
                    <td className={td}>
                      {row.edgaze_code ? (
                        <code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px]">
                          /{row.edgaze_code}
                        </code>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={td}>
                      {href ? (
                        <Link href={href} className="text-cyan-400 hover:text-cyan-300 text-[12px]">
                          View
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={td}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onDisqualify(kind, row.id)}
                        className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 text-[12px] font-medium text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
                      >
                        {busy ? "…" : "Disqualify"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DisqualifiedTable({
  title,
  rows,
  kind,
  busyId,
  onRestore,
}: {
  title: string;
  rows: DisqualifiedRow[];
  kind: "workflow" | "prompt";
  busyId: string | null;
  onRestore: (listingType: "workflow" | "prompt", listingId: string) => void;
}) {
  return (
    <section className={cn(card, "p-5 sm:p-6")}>
      <h2 className="text-sm font-semibold text-white/90 mb-1">{title}</h2>
      <p className="text-[12px] text-white/45 mb-4">
        These listings never appear in the landing trending carousel until restored.
      </p>
      {rows.length === 0 ? (
        <p className="text-[13px] text-white/50">None.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr>
                <th className={th}>Listing</th>
                <th className={th}>Code</th>
                <th className={th}>Updated</th>
                <th className={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const href = listingHref(kind, row.owner_handle, row.edgaze_code);
                const id = `dq:${kind}:${row.id}`;
                const busy = busyId === id;
                return (
                  <tr key={row.id}>
                    <td className={td}>
                      <div className="font-medium text-white/95">{row.title || "—"}</div>
                      <div className="mt-0.5 text-[12px] text-white/50">
                        @{row.owner_handle?.replace(/^@/, "") || "—"}
                      </div>
                    </td>
                    <td className={td}>
                      {row.edgaze_code ? (
                        <code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px]">
                          /{row.edgaze_code}
                        </code>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={cn(td, "text-white/60 text-[12px]")}>
                      {row.updated_at ? new Date(row.updated_at).toLocaleString() : "—"}
                    </td>
                    <td className={td}>
                      <div className="flex flex-wrap gap-2">
                        {href ? (
                          <Link
                            href={href}
                            className="inline-flex items-center rounded-lg border border-white/15 px-2.5 py-1 text-[12px] text-white/75 hover:bg-white/5"
                          >
                            View
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onRestore(kind, row.id)}
                          className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-[12px] font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          {busy ? "…" : "Restore trending"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function AdminTrendingPage() {
  const { getAccessToken, authReady } = useAuth();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ApiPayload | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setErr("Not authenticated.");
        setLoading(false);
        return;
      }
      const res = await fetch("/api/admin/trending", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr((json as { error?: string }).error || "Failed to load.");
        setData(null);
        return;
      }
      setData(json as ApiPayload);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!authReady) return;
    load();
  }, [authReady, load]);

  async function setExcluded(
    listingType: "workflow" | "prompt",
    listingId: string,
    exclude: boolean,
    busyKey: string,
  ) {
    setBusyId(busyKey);
    setErr(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setErr("Not authenticated.");
        return;
      }
      const res = await fetch("/api/admin/trending", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ listing_type: listingType, listing_id: listingId, exclude }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr((json as { error?: string }).error || "Update failed.");
        return;
      }
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/25 bg-cyan-500/10">
            <TrendingUp className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Trending
            </h1>
            <p className="mt-0.5 text-[13px] text-white/55">
              Live snapshot of what appears on the landing page and manual exclusions.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-[13px] font-medium text-white/85 hover:bg-white/[0.07] disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </button>
      </div>

      {err ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-100">
          {err}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-white/30" />
        </div>
      ) : data ? (
        <div className="space-y-8">
          <TrendingTable
            title="Trending workflows (landing carousel)"
            rows={data.trending_workflows}
            kind="workflow"
            busyId={busyId}
            onDisqualify={(t, id) => setExcluded(t, id, true, `${t}:${id}`)}
          />
          <TrendingTable
            title="Trending prompts (landing carousel)"
            rows={data.trending_prompts}
            kind="prompt"
            busyId={busyId}
            onDisqualify={(t, id) => setExcluded(t, id, true, `${t}:${id}`)}
          />
          <DisqualifiedTable
            title="Disqualified workflows"
            rows={data.disqualified_workflows}
            kind="workflow"
            busyId={busyId}
            onRestore={(t, id) => setExcluded(t, id, false, `dq:${t}:${id}`)}
          />
          <DisqualifiedTable
            title="Disqualified prompts"
            rows={data.disqualified_prompts}
            kind="prompt"
            busyId={busyId}
            onRestore={(t, id) => setExcluded(t, id, false, `dq:${t}:${id}`)}
          />
        </div>
      ) : null}
    </div>
  );
}

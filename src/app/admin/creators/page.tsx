"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Plus, Users } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { DEFAULT_AVATAR_SRC } from "@/config/branding";

type CreatorRow = {
  id: string;
  handle: string;
  full_name: string | null;
  avatar_url: string | null;
  email?: string | null;
  source: string | null;
  claim_status: string | null;
  claimed_at: string | null;
  provisioned_at: string | null;
  created_at: string | null;
  can_receive_payments?: boolean | null;
  stripe_onboarding_status?: string | null;
  active_fee_override?: {
    platform_fee_percentage: number;
    ends_at: string;
  } | null;
};

const cardClass =
  "rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]";

function maskEmail(email: string | undefined | null) {
  if (!email) return "—";
  const [u, d] = email.split("@");
  if (!d) return "***";
  const prefix = (u ?? "").slice(0, 2);
  return `${prefix}***@${d}`;
}

export default function AdminCreatorsPage() {
  const { authReady, getAccessToken } = useAuth();
  const [rows, setRows] = useState<CreatorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unclaimed" | "claimed" | "provisioned">("all");
  const [payoutFilter, setPayoutFilter] = useState<"all" | "ready" | "pending">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    main.style.overflowY = "auto";
    main.style.overflowX = "hidden";
    return () => {
      main.style.overflowY = "";
      main.style.overflowX = "";
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const sp = new URLSearchParams();
      if (filter === "unclaimed") sp.set("claim_status", "unclaimed");
      if (filter === "claimed") sp.set("claim_status", "claimed");
      if (filter === "provisioned") sp.set("source", "admin_provisioned");
      if (payoutFilter !== "all") sp.set("payout_status", payoutFilter);
      if (search.trim()) sp.set("q", search.trim());
      const q = sp.toString();
      const res = await fetch(`/api/admin/creators${q ? `?${q}` : ""}`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRows(data.creators || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, filter, payoutFilter, search]);

  useEffect(() => {
    if (!authReady) return;
    void load();
  }, [authReady, load]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
            <Users className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Creator workspaces</h1>
            <p className="mt-1 text-sm text-white/50">
              Provision profiles, send claim links, and impersonate for support.
            </p>
          </div>
        </div>
        <Link
          href="/admin/creators/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/15 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New creator
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["provisioned", "Admin-provisioned"],
            ["unclaimed", "Unclaimed"],
            ["claimed", "Claimed"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === key
                ? "bg-white text-black"
                : "border border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All payouts"],
              ["ready", "Payout-ready"],
              ["pending", "Needs onboarding"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPayoutFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                payoutFilter === key
                  ? "bg-cyan-300 text-black"
                  : "border border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search handle, name, or email"
          className="w-full md:w-[320px] rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-white/35 outline-none transition-colors focus:border-cyan-400/40"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <div className={cardClass}>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-white/50">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-white/45">
            No creators match this filter. Create a workspace to get started.
          </div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-white/[0.06]">
              {rows.map((r) => (
                <Link
                  key={r.id}
                  href={`/admin/creators/${r.id}`}
                  className="flex items-center gap-3 px-4 py-4 min-w-0 active:bg-white/[0.04] transition-colors"
                >
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/10">
                    <Image
                      src={r.avatar_url || DEFAULT_AVATAR_SRC}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="44px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-white truncate">
                          {r.full_name || "Unnamed"}
                        </div>
                        <div className="text-xs text-white/45 truncate">@{r.handle}</div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          r.claim_status === "claimed"
                            ? "bg-emerald-500/15 text-emerald-200"
                            : "bg-amber-500/15 text-amber-100"
                        }`}
                      >
                        {r.claim_status || "—"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/45">
                      <span>{r.source || "—"}</span>
                      <span className="font-mono text-white/40">{maskEmail(r.email)}</span>
                      <span
                        className={
                          r.can_receive_payments ? "text-emerald-300/90" : "text-amber-200/90"
                        }
                      >
                        {r.can_receive_payments ? "Payout-ready" : "Needs onboarding"}
                      </span>
                      {r.active_fee_override ? (
                        <span className="text-cyan-200/90">
                          0% fee until{" "}
                          {new Date(r.active_fee_override.ends_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    <th className="px-4 py-3">Creator</th>
                    <th className="px-4 py-3">Claim</th>
                    <th className="px-4 py-3">Payouts</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Fee policy</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/creators/${r.id}`}
                          className="flex items-center gap-3 min-w-0 group"
                        >
                          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10">
                            <Image
                              src={r.avatar_url || DEFAULT_AVATAR_SRC}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="36px"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-white group-hover:text-cyan-200 transition-colors">
                              {r.full_name || "Unnamed"}
                            </div>
                            <div className="truncate text-xs text-white/45">@{r.handle}</div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            r.claim_status === "claimed"
                              ? "bg-emerald-500/15 text-emerald-200"
                              : "bg-amber-500/15 text-amber-100"
                          }`}
                        >
                          {r.claim_status || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            r.can_receive_payments
                              ? "bg-emerald-500/15 text-emerald-200"
                              : "bg-amber-500/15 text-amber-100"
                          }`}
                        >
                          {r.can_receive_payments ? "Payout-ready" : "Needs onboarding"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/60">{r.source || "—"}</td>
                      <td className="px-4 py-3 text-xs text-white/55">
                        {r.active_fee_override ? (
                          <span className="text-cyan-200">
                            0% until{" "}
                            {new Date(r.active_fee_override.ends_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        ) : (
                          "Default fee"
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-white/50">
                        {maskEmail(r.email)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/creators/${r.id}`}
                          className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

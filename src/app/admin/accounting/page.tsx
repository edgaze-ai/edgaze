"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileDown,
  Loader2,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

const cardClass =
  "rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]";

type Stats = {
  workflowSalesTotal: number;
  promptSalesTotal: number;
  paidWorkflowGmvCents: number;
  paidPromptGmvCents: number;
};

type TransactionRow = {
  purchase_id: string;
  purchase_type: string;
  resource_id: string;
  buyer_id: string;
  creator_id: string;
  status: string;
  amount_cents: number | null;
  platform_fee_cents: number | null;
  creator_net_cents: number | null;
  currency: string;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  payment_method_type: string | null;
  created_at: string;
  refunded_at: string | null;
  disputed_at: string | null;
  resource_title: string | null;
  edgaze_code: string | null;
  creator_handle: string | null;
  creator_email: string | null;
  buyer_handle: string | null;
  buyer_email: string | null;
  earning_id: string | null;
  earning_status: string | null;
  claim_deadline_at: string | null;
  stripe_account_id_on_earning: string | null;
  stripe_transfer_id: string | null;
  earning_created_at: string | null;
  earning_paid_at: string | null;
  earning_refunded_at: string | null;
  connect_stripe_account_id: string | null;
  connect_account_status: string | null;
  connect_charges_enabled: boolean | null;
  connect_payouts_enabled: boolean | null;
  first_sale_email_sent_at: string | null;
  workflow_version_id?: string | null;
  listing_live?: boolean | null;
  listing_state?: string | null;
  buyer_access_active?: boolean | null;
  audit_purchase_logged_at?: string | null;
  purchase_fulfilled_at?: string | null;
  funds_route?: string | null;
};

function formatUsd(cents: number | null | undefined) {
  if (cents == null || Number.isNaN(cents)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatDt(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function rowExpandKey(r: TransactionRow) {
  if (r.stripe_payment_intent_id?.startsWith("pi_")) return r.stripe_payment_intent_id;
  return `${r.purchase_type}:${r.purchase_id}`;
}

function fundsRouteLabel(route: string | null | undefined) {
  if (route === "platform_hold") return "Platform (claim window)";
  if (route === "creator_connect") return "Creator · Connect";
  if (route === "creator_no_connect_row") return "Creator (no Connect row)";
  return route || "—";
}

function accessSummary(r: TransactionRow) {
  if (r.buyer_access_active) return { label: "Active in app", tone: "text-emerald-200" as const };
  if (r.status === "refunded")
    return { label: "Revoked (refunded)", tone: "text-amber-200/90" as const };
  if (r.status === "disputed") return { label: "Disputed", tone: "text-amber-200/90" as const };
  if (r.status === "paid") return { label: "Paid (check refund)", tone: "text-white/55" as const };
  return { label: r.status || "—", tone: "text-white/50" as const };
}

export default function AdminAccountingPage() {
  const { authReady, getAccessToken } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "workflow" | "prompt">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "refunded" | "disputed">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [detailLoadingKey, setDetailLoadingKey] = useState<string | null>(null);
  const [detailByKey, setDetailByKey] = useState<Record<string, unknown>>({});

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
      sp.set("page", String(page));
      sp.set("limit", "40");
      if (typeFilter !== "all") sp.set("type", typeFilter);
      if (statusFilter !== "all") sp.set("status", statusFilter);
      if (dateFrom.trim()) sp.set("from", new Date(`${dateFrom.trim()}T00:00:00`).toISOString());
      if (dateTo.trim()) sp.set("to", new Date(`${dateTo.trim()}T23:59:59.999`).toISOString());
      const res = await fetch(`/api/admin/accounting/transactions?${sp}`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setStats(data.stats);
      setRows(data.transactions || []);
      setTotalPages(data.pagination?.totalPages ?? 1);
      setTotal(data.pagination?.total ?? 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, page, typeFilter, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (!authReady) return;
    void load();
  }, [authReady, load]);

  const downloadPdf = async () => {
    setPdfLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const sp = new URLSearchParams();
      if (typeFilter !== "all") sp.set("type", typeFilter);
      if (statusFilter !== "all") sp.set("status", statusFilter);
      if (dateFrom.trim()) sp.set("from", new Date(`${dateFrom.trim()}T00:00:00`).toISOString());
      if (dateTo.trim()) sp.set("to", new Date(`${dateTo.trim()}T23:59:59.999`).toISOString());
      const res = await fetch(`/api/admin/accounting/statement?${sp}`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "PDF failed");
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `edgaze-statement-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(href);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "PDF export failed");
    } finally {
      setPdfLoading(false);
    }
  };

  const toggleExpand = async (r: TransactionRow) => {
    const key = rowExpandKey(r);
    if (expandedKey === key) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(key);
    if (detailByKey[key]) return;
    setDetailLoadingKey(key);
    try {
      const token = await getAccessToken();
      const sp = new URLSearchParams();
      if (r.stripe_payment_intent_id?.startsWith("pi_")) {
        sp.set("paymentIntentId", r.stripe_payment_intent_id);
      } else {
        sp.set("purchaseId", r.purchase_id);
        sp.set("purchaseType", r.purchase_type);
      }
      const res = await fetch(`/api/admin/accounting/transactions/detail?${sp}`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = res.ok ? await res.json() : { error: await res.text() };
      setDetailByKey((prev) => ({ ...prev, [key]: json }));
    } catch (e: unknown) {
      setDetailByKey((prev) => ({
        ...prev,
        [key]: { error: e instanceof Error ? e.message : "Detail failed" },
      }));
    } finally {
      setDetailLoadingKey(null);
    }
  };

  const gmvCents = (stats?.paidWorkflowGmvCents ?? 0) + (stats?.paidPromptGmvCents ?? 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
            <CreditCard className="h-5 w-5 text-emerald-300" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Accounting</h1>
            <p className="mt-1 text-sm text-white/50">
              Every paid marketplace sale: buyer → seller, amounts, Connect / funds route, whether
              the buyer’s access row is active (delivered when the checkout webhook completes), and
              Stripe detail on expand.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={pdfLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/35 bg-emerald-400/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/15 transition-colors disabled:opacity-50"
          >
            {pdfLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            Download PDF statement
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/85 hover:bg-white/[0.07] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`${cardClass} p-5`}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
            Paid GMV (active)
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
            {formatUsd(gmvCents)}
          </p>
          <p className="mt-1 text-xs text-white/45">Excludes fully refunded purchases</p>
        </div>
        <div className={`${cardClass} p-5`}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
            Workflow charges
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
            {stats?.workflowSalesTotal ?? "—"}
          </p>
          <p className="mt-1 text-xs text-white/45">
            {formatUsd(stats?.paidWorkflowGmvCents ?? 0)} in paid status
          </p>
        </div>
        <div className={`${cardClass} p-5`}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
            Prompt charges
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
            {stats?.promptSalesTotal ?? "—"}
          </p>
          <p className="mt-1 text-xs text-white/45">
            {formatUsd(stats?.paidPromptGmvCents ?? 0)} in paid status
          </p>
        </div>
        <div className={`${cardClass} p-5`}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
            Rows (filters)
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{total}</p>
          <p className="mt-1 text-xs text-white/45">Total records matching filters</p>
        </div>
      </div>

      <div className={`${cardClass} p-4 space-y-4`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-col gap-1">
            <label htmlFor="acct-from" className="text-[11px] font-medium text-white/45">
              From
            </label>
            <input
              id="acct-from"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setPage(1);
                setDateFrom(e.target.value);
              }}
              className="rounded-xl border border-white/[0.1] bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="acct-to" className="text-[11px] font-medium text-white/45">
              Through
            </label>
            <input
              id="acct-to"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setPage(1);
                setDateTo(e.target.value);
              }}
              className="rounded-xl border border-white/[0.1] bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/40"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              setDateFrom("");
              setDateTo("");
            }}
            className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/70 hover:bg-white/[0.07] sm:mb-0.5"
          >
            Clear dates
          </button>
        </div>
        <div className="h-px bg-white/[0.06]" />
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="text-xs font-medium text-white/40">Type</span>
          {(["all", "workflow", "prompt"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setPage(1);
                setTypeFilter(k);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                typeFilter === k
                  ? "bg-white text-black"
                  : "bg-white/[0.06] text-white/70 hover:text-white"
              }`}
            >
              {k === "all" ? "All" : k}
            </button>
          ))}
          <span className="text-xs font-medium text-white/40 sm:ml-4">Status</span>
          {(["all", "paid", "refunded", "disputed"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setPage(1);
                setStatusFilter(k);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === k
                  ? "bg-white text-black"
                  : "bg-white/[0.06] text-white/70 hover:text-white"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className={`${cardClass} overflow-hidden`}>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-white/50">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading transactions…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-white/45">
            No transactions for this filter.
          </p>
        ) : (
          <>
            <div className="divide-y divide-white/[0.06] md:hidden">
              {rows.map((r) => {
                const exKey = rowExpandKey(r);
                const open = expandedKey === exKey;
                const access = accessSummary(r);
                return (
                  <div key={exKey} className="space-y-3 p-4">
                    <button
                      type="button"
                      onClick={() => void toggleExpand(r)}
                      className="flex w-full items-start gap-3 text-left min-w-0"
                    >
                      <span className="mt-0.5 text-white/45 shrink-0">
                        {open ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="font-medium text-white/90 line-clamp-2">
                          {r.resource_title || "—"}{" "}
                          <span className="text-white/35 font-normal">
                            ({r.purchase_type === "workflow" ? "Workflow" : "Prompt"})
                          </span>
                        </div>
                        <div className="text-[11px] text-white/45 tabular-nums">
                          {formatDt(r.created_at)}
                        </div>
                        <div className="text-[12px] text-white/55">
                          Paid by @{r.buyer_handle || "—"} → seller @{r.creator_handle || "—"}
                        </div>
                        <div className={`text-[11px] font-medium ${access.tone}`}>
                          {access.label}
                        </div>
                        <div className="text-[10px] text-white/40">
                          Fulfilled {formatDt(r.purchase_fulfilled_at)}
                          {r.audit_purchase_logged_at
                            ? ` · audit ${formatDt(r.audit_purchase_logged_at)}`
                            : ""}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-white/75">
                            {r.status}
                          </span>
                          <span className="tabular-nums text-sm font-semibold text-white">
                            {formatUsd(r.amount_cents)}
                          </span>
                          <span className="tabular-nums text-sm text-emerald-200/90">
                            Net {formatUsd(r.creator_net_cents)}
                          </span>
                        </div>
                      </div>
                    </button>
                    {open ? (
                      <div className="rounded-xl border border-white/[0.06] bg-black/25 p-3">
                        {detailLoadingKey === exKey && (
                          <div className="flex items-center gap-2 text-sm text-white/50">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading Stripe &amp; payout detail…
                          </div>
                        )}
                        {detailLoadingKey !== exKey && detailByKey[exKey] != null && (
                          <DetailPanel
                            row={r}
                            payload={detailByKey[exKey] as Record<string, unknown>}
                          />
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1280px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    <th className="w-8 px-4 py-3" />
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Listing</th>
                    <th className="px-4 py-3">Paid by → Seller</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Creator net</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Product access</th>
                    <th className="px-4 py-3">Fulfilled</th>
                    <th className="px-4 py-3">Funds</th>
                    <th className="px-4 py-3">Connect</th>
                    <th className="px-4 py-3">First-sale email</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const exKey = rowExpandKey(r);
                    const open = expandedKey === exKey;
                    const connectLinked = Boolean(r.connect_stripe_account_id);
                    const access = accessSummary(r);
                    return (
                      <Fragment key={exKey}>
                        <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 align-top">
                            <button
                              type="button"
                              onClick={() => void toggleExpand(r)}
                              className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white"
                              aria-label={open ? "Collapse" : "Expand"}
                            >
                              {open ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 align-top text-white/80 tabular-nums whitespace-nowrap">
                            {formatDt(r.created_at)}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="font-medium text-white/90">
                              {r.resource_title || "—"}{" "}
                              <span className="text-white/35 font-normal">
                                ({r.purchase_type === "workflow" ? "Workflow" : "Prompt"})
                              </span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-white/45 font-mono">
                              {r.edgaze_code || "—"}
                            </div>
                            <div className="mt-1 text-[10px] text-white/38">
                              Listing: {r.listing_state ?? "—"}
                              {r.purchase_type === "workflow" && r.workflow_version_id
                                ? ` · version ${String(r.workflow_version_id).slice(0, 8)}…`
                                : ""}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="text-[12px] text-white/82">
                              <span className="text-white/55">Buyer</span> @{r.buyer_handle || "—"}
                            </div>
                            <div className="text-[11px] text-white/40 truncate max-w-[220px]">
                              {r.buyer_email || "—"}
                            </div>
                            <div className="mt-2 text-[12px] text-white/82">
                              <span className="text-white/55">Seller</span> @
                              {r.creator_handle || "—"}
                            </div>
                            <div className="text-[11px] text-white/40 truncate max-w-[220px]">
                              {r.creator_email || "—"}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top text-right tabular-nums text-white/90">
                            {formatUsd(r.amount_cents)}
                          </td>
                          <td className="px-4 py-3 align-top text-right tabular-nums text-emerald-200/90">
                            {formatUsd(r.creator_net_cents)}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-white/75">
                              {r.status}
                            </span>
                            {r.earning_status && (
                              <div className="mt-1 text-[10px] text-white/35">
                                earning: {r.earning_status}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <span className={`text-[12px] font-medium ${access.tone}`}>
                              {access.label}
                            </span>
                            <div className="mt-1 text-[10px] text-white/40 leading-snug">
                              Same moment as successful checkout webhook: library / run access uses
                              this purchase row (paid + not refunded).
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top text-[11px] text-white/75 whitespace-nowrap">
                            <div>{formatDt(r.purchase_fulfilled_at)}</div>
                            {r.audit_purchase_logged_at && (
                              <div className="mt-0.5 text-[10px] text-white/40">
                                Audit: {formatDt(r.audit_purchase_logged_at)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 align-top text-[11px] text-white/70">
                            {fundsRouteLabel(r.funds_route)}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="text-[11px] text-white/70">
                              {connectLinked ? "Linked" : "Not linked"}
                            </div>
                            <div
                              className="mt-0.5 font-mono text-[10px] text-white/40 truncate max-w-[160px]"
                              title={r.connect_stripe_account_id || undefined}
                            >
                              {r.connect_stripe_account_id
                                ? `${r.connect_stripe_account_id.slice(0, 14)}…`
                                : "—"}
                            </div>
                            {r.connect_account_status && (
                              <div className="text-[10px] text-white/35">
                                {r.connect_account_status}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 align-top text-white/65 text-[11px] whitespace-nowrap">
                            {r.first_sale_email_sent_at
                              ? formatDt(r.first_sale_email_sent_at)
                              : "—"}
                          </td>
                        </tr>
                        {open && (
                          <tr className="border-b border-white/[0.06] bg-black/20">
                            <td colSpan={12} className="px-4 py-4">
                              {detailLoadingKey === exKey && (
                                <div className="flex items-center gap-2 text-sm text-white/50">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Loading Stripe &amp; payout detail…
                                </div>
                              )}
                              {detailLoadingKey !== exKey && detailByKey[exKey] != null && (
                                <DetailPanel
                                  row={r}
                                  payload={detailByKey[exKey] as Record<string, unknown>}
                                />
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3 text-sm text-white/60">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/5 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="tabular-nums">
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailPanel({ row, payload }: { row: TransactionRow; payload: Record<string, unknown> }) {
  if (payload.error && typeof payload.error === "string") {
    return <p className="text-sm text-red-300">{payload.error}</p>;
  }

  const access = accessSummary(row);
  const stripe = payload.stripe as Record<string, unknown> | null | undefined;
  const claimEmails = (payload.claimEmails as { email_type: string; sent_at: string }[]) || [];
  const payouts = (payload.payoutsSincePurchase as Record<string, unknown>[]) || [];

  const stripeDash = "https://dashboard.stripe.com";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/45">
          Database snapshot
        </h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
          <dt className="text-white/40">Product access</dt>
          <dd className="text-white/80">
            <span className={access.tone}>{access.label}</span>
            <div className="mt-1 text-[11px] text-white/45">
              Fulfilled {formatDt(row.purchase_fulfilled_at)}
              {row.listing_state ? ` · listing ${row.listing_state}` : ""}
              {row.purchase_type === "workflow" && row.workflow_version_id
                ? ` · pinned version ${String(row.workflow_version_id).slice(0, 8)}…`
                : ""}
            </div>
          </dd>
          <dt className="text-white/40">PaymentIntent</dt>
          <dd className="font-mono text-xs text-cyan-200/90 break-all">
            {row.stripe_payment_intent_id?.startsWith("pi_") ? (
              <>
                {row.stripe_payment_intent_id}
                <a
                  href={`${stripeDash}/search?query=${encodeURIComponent(row.stripe_payment_intent_id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 inline-flex items-center gap-0.5 text-cyan-400/80 hover:text-cyan-300"
                >
                  Stripe <ExternalLink className="h-3 w-3" />
                </a>
              </>
            ) : (
              "—"
            )}
          </dd>
          <dt className="text-white/40">Checkout session</dt>
          <dd className="font-mono text-xs text-white/70 break-all">
            {row.stripe_checkout_session_id || "—"}
          </dd>
          <dt className="text-white/40">Transfer (DB)</dt>
          <dd className="font-mono text-xs text-white/70 break-all">
            {row.stripe_transfer_id || "—"}
          </dd>
          <dt className="text-white/40">Earning Stripe acct</dt>
          <dd className="font-mono text-xs text-white/70 break-all">
            {row.stripe_account_id_on_earning || "—"}
          </dd>
          <dt className="text-white/40">Platform hold / claim</dt>
          <dd className="text-white/70">
            {row.claim_deadline_at
              ? `Deadline ${formatDt(row.claim_deadline_at)}`
              : row.earning_status === "pending_claim"
                ? "pending_claim"
                : "—"}
          </dd>
          <dt className="text-white/40">Payment method</dt>
          <dd className="text-white/70">{row.payment_method_type || "—"}</dd>
        </dl>
      </div>

      <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/45">
          Claim notification emails
        </h3>
        {claimEmails.length === 0 ? (
          <p className="text-sm text-white/45">No rows in creator_pending_claim_email_log.</p>
        ) : (
          <ul className="space-y-1 text-[13px] text-white/75">
            {claimEmails.map((e) => (
              <li key={`${e.email_type}-${e.sent_at}`}>
                <span className="font-medium text-white/85">{e.email_type}</span>
                <span className="text-white/40"> · </span>
                {formatDt(e.sent_at)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 lg:col-span-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/45">
          Stripe (live)
        </h3>
        {!stripe || typeof stripe.error === "string" ? (
          <p className="text-sm text-amber-200/90">
            {(stripe?.error as string) || "No Stripe payload"}
          </p>
        ) : (
          <pre className="max-h-[320px] overflow-auto rounded-lg bg-black/40 p-3 text-[11px] leading-relaxed text-emerald-100/80">
            {JSON.stringify(stripe, null, 2)}
          </pre>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 lg:col-span-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/45">
          Creator payouts (since purchase, from DB / webhooks)
        </h3>
        {payouts.length === 0 ? (
          <p className="text-sm text-white/45">No payout rows recorded after this purchase.</p>
        ) : (
          <ul className="space-y-2 text-[13px] text-white/75">
            {payouts.map((p) => (
              <li
                key={String(p.id)}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-white/[0.04] pb-2"
              >
                <span className="font-mono text-xs text-white/60">
                  {String(p.stripe_payout_id)}
                </span>
                <span>{String(p.status)}</span>
                <span className="tabular-nums text-emerald-200/80">
                  {formatUsd(Number(p.amount_cents))}
                </span>
                <span className="text-white/40">{formatDt(String(p.created_at))}</span>
                {p.arrival_date != null && p.arrival_date !== "" && (
                  <span className="text-white/40">arrival {String(p.arrival_date)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

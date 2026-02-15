"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";
import { useAuth } from "../../../components/auth/AuthContext";

type ReportRow = {
  id: string;
  created_at: string;
  reporter_id: string;
  target_type: "prompt" | "workflow" | "comment" | "user";
  target_id: string;
  reason: string;
  details: string | null;
  evidence_urls: string[] | null;
  status: "open" | "triaged" | "actioned" | "rejected";
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  target_title?: string | null;
  target_owner_handle?: string | null;
  target_owner_name?: string | null;
  target_edgaze_code?: string | null;
};

function fmt(ts: string) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function targetHref(r: ReportRow, ownerHandle?: string | null, edgazeCode?: string | null) {
  if (r.target_type === "prompt") {
    if (ownerHandle && edgazeCode) return `/p/${ownerHandle}/${edgazeCode}`;
    return `/p/${r.target_id}`;
  }
  if (r.target_type === "workflow") {
    if (ownerHandle && edgazeCode) return `/${ownerHandle}/${edgazeCode}`;
    return `/${r.target_id}`;
  }
  if (r.target_type === "comment") return `/admin/moderation?focus=${r.id}`;
  return `/u/${r.target_id}`;
}

type Section = "reports" | "platform" | "tools";

function AdminToggle({
  checked,
  onToggle,
  disabled,
  labelOff,
  labelOn,
  variant = "default",
}: {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  labelOff: string;
  labelOn: string;
  variant?: "default" | "warning";
}) {
  const trackClass =
    variant === "warning"
      ? checked
        ? "bg-amber-500/25 border-amber-500/35 shadow-[inset_0_1px_0_rgba(251,191,36,0.15)]"
        : "bg-white/[0.06] border-white/[0.1]"
      : checked
        ? "bg-amber-500/25 border-amber-500/35 shadow-[inset_0_1px_0_rgba(251,191,36,0.15)]"
        : "bg-emerald-500/20 border-emerald-500/30 shadow-[inset_0_1px_0_rgba(34,197,94,0.1)]";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={checked ? labelOn : labelOff}
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-9 w-[7.25rem] shrink-0 items-center rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:ring-offset-2 focus:ring-offset-[#070708] disabled:opacity-50 disabled:cursor-not-allowed ${trackClass}`}
    >
      <span
        className={`absolute top-1/2 h-7 w-7 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.8)] transition-transform duration-200 left-0.5 ${
          checked ? "translate-x-[4.5rem]" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function AdminModerationPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { authReady, userId, getAccessToken } = useAuth();

  const [section, setSection] = useState<Section>("reports");
  const [tab, setTab] = useState<"open" | "triaged" | "all">("open");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [selected, setSelected] = useState<ReportRow | null>(null);

  const [notes, setNotes] = useState("");
  const [banUserId, setBanUserId] = useState("");
  const [banReason, setBanReason] = useState("");
  const [banExpiresAt, setBanExpiresAt] = useState<string>("");
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const [takedownReason, setTakedownReason] = useState("");
  const [takedownLoading, setTakedownLoading] = useState(false);

  const [replenishUsername, setReplenishUsername] = useState("");
  const [replenishWorkflowId, setReplenishWorkflowId] = useState("");
  const [replenishLoading, setReplenishLoading] = useState(false);

  const [refillWorkflowUsername, setRefillWorkflowUsername] = useState("");
  const [refillWorkflowId, setRefillWorkflowId] = useState("");
  const [refillWorkflowLoading, setRefillWorkflowLoading] = useState(false);

  const [appsPausedLoading, setAppsPausedLoading] = useState(true);
  const [appsPausedSaving, setAppsPausedSaving] = useState(false);
  const [appsPaused, setAppsPaused] = useState(false);

  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const loadAppsPaused = useCallback(async () => {
    setAppsPausedLoading(true);
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "applications_paused")
        .maybeSingle();
      if (error) throw error;
      setAppsPaused(Boolean((data as any)?.value));
    } catch {
      setAppsPaused(false);
    } finally {
      setAppsPausedLoading(false);
    }
  }, [supabase]);

  async function saveAppsPaused(next: boolean) {
    setAppsPausedSaving(true);
    setActionMsg(null);
    try {
      const { error } = await supabase.rpc("upsert_app_setting", {
        p_key: "applications_paused",
        p_value: next,
      });
      if (error) throw error;
      setAppsPaused(next);
      setActionMsg(next ? "Applications paused." : "Applications resumed.");
    } catch (e: any) {
      setActionMsg(e?.message || "Failed to update applications setting.");
    } finally {
      setAppsPausedSaving(false);
    }
  }

  const loadMaintenanceMode = useCallback(async () => {
    setMaintenanceLoading(true);
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "maintenance_mode")
        .maybeSingle();
      if (error) throw error;
      setMaintenanceMode(Boolean((data as any)?.value));
    } catch {
      setMaintenanceMode(false);
    } finally {
      setMaintenanceLoading(false);
    }
  }, [supabase]);

  async function saveMaintenanceMode(next: boolean) {
    setMaintenanceSaving(true);
    setActionMsg(null);
    try {
      const { error } = await supabase.rpc("upsert_app_setting", {
        p_key: "maintenance_mode",
        p_value: next,
      });
      if (error) throw error;
      setMaintenanceMode(next);
      setActionMsg(next ? "Maintenance mode enabled." : "Maintenance mode disabled.");
    } catch (e: any) {
      setActionMsg(e?.message || "Failed to update maintenance mode.");
    } finally {
      setMaintenanceSaving(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setActionMsg(null);
    let q = supabase.from("reports").select("*").order("created_at", { ascending: false });
    if (tab === "open") q = q.in("status", ["open"]);
    if (tab === "triaged") q = q.in("status", ["triaged"]);
    const { data, error } = await q.limit(200);

    if (error) {
      setRows([]);
      setSelected(null);
      setLoading(false);
      setActionMsg(error.message);
      return;
    }

    const list = (data as any as ReportRow[]) || [];
    const enrichedList = await Promise.all(
      list.map(async (report) => {
        if (report.target_type === "prompt" || report.target_type === "workflow") {
          const tableName = report.target_type === "prompt" ? "prompts" : "workflows";
          const { data: product } = await supabase
            .from(tableName)
            .select("title, owner_handle, owner_name, edgaze_code")
            .eq("id", report.target_id)
            .maybeSingle();
          if (product) {
            return {
              ...report,
              target_title: product.title,
              target_owner_handle: product.owner_handle,
              target_owner_name: product.owner_name,
              target_edgaze_code: product.edgaze_code,
            };
          }
        }
        return report;
      })
    );
    setRows(enrichedList);
    setSelected((prev) => (prev ? enrichedList.find((x) => x.id === prev.id) ?? null : null));
    setLoading(false);
  }, [supabase, tab]);

  useEffect(() => {
    if (!authReady || !userId) return;
    load();
    loadAppsPaused();
    loadMaintenanceMode();
  }, [authReady, userId, tab, load, loadAppsPaused, loadMaintenanceMode]);

  useEffect(() => {
    const chApps = supabase
      .channel("realtime:app_settings:applications_paused_admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: "key=eq.applications_paused" },
        (payload: any) => setAppsPaused(Boolean(payload?.new?.value))
      )
      .subscribe();
    const chMaint = supabase
      .channel("realtime:app_settings:maintenance_mode_admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: "key=eq.maintenance_mode" },
        (payload: any) => setMaintenanceMode(Boolean(payload?.new?.value))
      )
      .subscribe();
    return () => {
      try {
        supabase.removeChannel(chApps);
        supabase.removeChannel(chMaint);
      } catch {}
    };
  }, [supabase]);

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

  async function setStatus(id: string, status: ReportRow["status"]) {
    setActionMsg(null);
    const payload: any = {
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
      admin_notes: notes || null,
    };
    const { error } = await supabase.from("reports").update(payload).eq("id", id);
    if (error) {
      setActionMsg(error.message);
      return;
    }
    await load();
  }

  async function banOrUnban(isBanned: boolean) {
    setActionMsg(null);
    const uid = (banUserId || "").trim();
    if (!uid) {
      setActionMsg("Missing user id");
      return;
    }
    const expires = banExpiresAt && banExpiresAt.trim() ? new Date(banExpiresAt).toISOString() : null;
    const { error } = await supabase.rpc("admin_set_ban", {
      p_user_id: uid,
      p_is_banned: isBanned,
      p_reason: banReason || null,
      p_expires_at: expires,
    });
    if (error) {
      setActionMsg(error.message);
      return;
    }
    setActionMsg(isBanned ? "User banned." : "User unbanned.");
  }

  async function replenishDemo() {
    setActionMsg(null);
    setReplenishLoading(true);
    const username = replenishUsername.trim();
    if (!username) {
      setActionMsg("Username is required");
      setReplenishLoading(false);
      return;
    }
    try {
      const token = await getAccessToken();
      if (!token) {
        setActionMsg("Not authenticated.");
        setReplenishLoading(false);
        return;
      }
      const response = await fetch("/api/admin/replenish-demo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: username.replace(/^@/, ""),
          workflowId: replenishWorkflowId.trim() || null,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setActionMsg(result.error || "Failed to replenish demo runs");
        return;
      }
      setActionMsg(result.message || "Demo runs replenished successfully");
      setReplenishUsername("");
      setReplenishWorkflowId("");
    } catch (error: any) {
      setActionMsg(error.message || "Failed to replenish demo runs");
    } finally {
      setReplenishLoading(false);
    }
  }

  async function refillWorkflowRuns() {
    setActionMsg(null);
    setRefillWorkflowLoading(true);
    const username = refillWorkflowUsername.trim();
    if (!username) {
      setActionMsg("Username is required for workflow run refill.");
      setRefillWorkflowLoading(false);
      return;
    }
    try {
      const token = await getAccessToken();
      if (!token) {
        setActionMsg("Not authenticated.");
        setRefillWorkflowLoading(false);
        return;
      }
      const response = await fetch("/api/admin/refill-workflow-runs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: username.replace(/^@/, ""),
          workflowId: refillWorkflowId.trim() || null,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setActionMsg(result.error || "Failed to refill workflow runs");
        return;
      }
      setActionMsg(result.message || "Workflow runs refilled successfully.");
      setRefillWorkflowUsername("");
      setRefillWorkflowId("");
    } catch (error: unknown) {
      setActionMsg(error instanceof Error ? error.message : "Failed to refill workflow runs");
    } finally {
      setRefillWorkflowLoading(false);
    }
  }

  function pick(r: ReportRow) {
    setSelected(r);
    setNotes(r.admin_notes || "");
    setBanUserId(r.target_type === "user" ? r.target_id : "");
    setBanReason("");
    setBanExpiresAt("");
    setTakedownReason("");
  }

  async function takeDownListing() {
    if (!selected || (selected.target_type !== "prompt" && selected.target_type !== "workflow")) return;
    const reason = takedownReason.trim();
    if (!reason) {
      setActionMsg("Enter a reason for the takedown.");
      return;
    }
    setActionMsg(null);
    setTakedownLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setActionMsg("Not authenticated.");
        return;
      }
      const res = await fetch("/api/admin/takedown", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          target_type: selected.target_type,
          target_id: selected.target_id,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMsg(data.error || "Takedown failed.");
        return;
      }
      setActionMsg("Taken down.");
      setTakedownReason("");
      await setStatus(selected.id, "actioned");
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : "Takedown failed.");
    } finally {
      setTakedownLoading(false);
    }
  }

  const cardClass =
    "rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset,0_4px_24px_-4px_rgba(0,0,0,0.4)]";
  const cardHeaderClass =
    "text-[11px] font-semibold uppercase tracking-widest text-white/45 mb-1.5";
  const inputClass =
    "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-white placeholder:text-white/35 outline-none transition-all focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/10 focus:bg-white/[0.04]";

  return (
    <div className="space-y-10">
      {/* Section tabs */}
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Moderation
          </h1>
          <p className="mt-1 text-[13px] text-white/50">
            Review reports, control platform settings, and manage users
          </p>
        </div>
        <nav className="flex rounded-xl border border-white/[0.06] bg-white/[0.02] p-1 shadow-sm">
          {(
            [
              ["reports", "Reports"],
              ["platform", "Platform"],
              ["tools", "Tools"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={`rounded-lg px-5 py-2.5 text-[13px] font-medium transition-all ${
                section === key
                  ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  : "text-white/55 hover:text-white/85 hover:bg-white/[0.05]"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {actionMsg ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3.5 text-[13px] text-amber-200/95 shadow-[0_1px_0_0_rgba(251,191,36,0.1)_inset]"
        >
          {actionMsg}
        </div>
      ) : null}

      {/* Reports */}
      {section === "reports" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-[13px] text-white/50 max-w-xl">
              Review and action user reports. Mark triaged, actioned, or rejected. Takedown prompts/workflows when needed.
            </p>
            <div className="flex items-center gap-2">
              {(["open", "triaged", "all"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-lg border px-4 py-2.5 text-[13px] font-medium transition-all ${
                    tab === t
                      ? "border-white/15 bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                      : "border-white/[0.08] bg-white/[0.03] text-white/65 hover:bg-white/[0.06] hover:text-white/85"
                  }`}
                >
                  {t === "open" ? "Open" : t === "triaged" ? "Triaged" : "All"}
                </button>
              ))}
              <button
                onClick={load}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-[13px] font-medium text-white/65 hover:bg-white/[0.06] hover:text-white/85 transition-all"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className={`${cardClass} flex flex-col overflow-hidden lg:col-span-1`}>
              <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
                <span className={cardHeaderClass}>Queue</span>
                <span className="text-[13px] font-semibold tabular-nums text-white/55">{rows.length}</span>
              </div>
              {loading ? (
                <div className="flex flex-col items-center justify-center px-6 py-12 gap-3">
                  <div className="h-6 w-6 rounded-full border-2 border-cyan-400/20 border-t-cyan-400/80 animate-spin" />
                  <p className="text-[13px] text-white/45">Loading…</p>
                </div>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                  <p className="text-[13px] text-white/45">No reports in this view</p>
                  <p className="mt-1 text-[12px] text-white/35">Try another filter or check back later</p>
                </div>
              ) : (
                <div className="max-h-[65vh] overflow-y-auto">
                  {rows.map((r) => {
                    const active = selected?.id === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => pick(r)}
                        className={`w-full text-left border-b border-white/[0.05] px-6 py-4 transition-all last:border-0 hover:bg-white/[0.04] relative ${
                          active
                            ? "bg-white/[0.06] border-l-2 border-l-cyan-500/60 pl-[22px]"
                            : "border-l-2 border-l-transparent"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium text-white/90 truncate">
                            {r.target_type} · {r.reason}
                          </span>
                          <span
                            className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                              r.status === "open"
                                ? "border-cyan-400/25 bg-cyan-500/15 text-cyan-300/95"
                                : r.status === "triaged"
                                  ? "border-purple-400/25 bg-purple-500/15 text-purple-300/95"
                                  : r.status === "actioned"
                                    ? "border-emerald-400/25 bg-emerald-500/15 text-emerald-300/95"
                                    : "border-white/10 bg-white/5 text-white/45"
                            }`}
                          >
                            {r.status}
                          </span>
                        </div>
                        <div className="mt-1.5 text-[12px] text-white/40">{fmt(r.created_at)}</div>
                        {r.details ? (
                          <div className="mt-1.5 line-clamp-2 text-[12px] text-white/50">{r.details}</div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={`${cardClass} p-6 lg:col-span-2`}>
              {!selected ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 mb-4">
                    <div className="h-12 w-12 rounded-xl bg-white/[0.05] flex items-center justify-center mx-auto text-white/30 text-2xl font-light">
                      →
                    </div>
                  </div>
                  <p className="text-[14px] font-medium text-white/50">Select a report from the queue</p>
                  <p className="mt-1 text-[12px] text-white/35">Details and actions will appear here</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        {selected.target_type} reported
                      </h2>
                      <p className="mt-1.5 text-[12px] text-white/45">
                        {fmt(selected.created_at)} · reporter {selected.reporter_id}
                      </p>
                    </div>
                    <a
                      href={targetHref(selected, selected.target_owner_handle, selected.target_edgaze_code)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-[13px] font-medium text-white/90 hover:bg-white/[0.08] hover:border-white/[0.15] transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    >
                      Open target
                    </a>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                      <p className={cardHeaderClass}>Target</p>
                      <p className="mt-2 text-[13px] text-white/75">
                        {selected.target_type}
                        {(selected.target_type === "prompt" || selected.target_type === "workflow") &&
                          selected.target_title && (
                            <span className="mt-1 block font-medium text-white/95">
                              {selected.target_title}
                            </span>
                          )}
                        {selected.target_owner_handle && (
                          <span className="mt-1 block text-xs text-white/55">
                            by @{selected.target_owner_handle}
                            {selected.target_owner_name && ` (${selected.target_owner_name})`}
                          </span>
                        )}
                        {selected.target_edgaze_code && (
                          <span className="mt-0.5 block text-xs text-white/45">
                            Code: {selected.target_edgaze_code}
                          </span>
                        )}
                        <span className="mt-1 block break-all text-xs text-white/40">
                          {selected.target_id}
                        </span>
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                      <p className={cardHeaderClass}>Reason</p>
                      <p className="mt-2 text-[13px] text-white/85">{selected.reason}</p>
                    </div>
                  </div>

                  {selected.details ? (
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                      <p className={cardHeaderClass}>Details</p>
                      <p className="mt-2 whitespace-pre-wrap text-[13px] text-white/85 leading-relaxed">
                        {selected.details}
                      </p>
                    </div>
                  ) : null}

                  {selected.evidence_urls && selected.evidence_urls.length > 0 ? (
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                      <p className={cardHeaderClass}>Evidence</p>
                      <div className="mt-2 space-y-1.5">
                        {selected.evidence_urls.map((u) => (
                          <a
                            key={u}
                            href={u}
                            target="_blank"
                            rel="noreferrer"
                            className="block break-all text-[13px] text-cyan-400/90 hover:text-cyan-300 hover:underline transition-colors"
                          >
                            {u}
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                    <p className={`${cardHeaderClass} mb-2`}>Admin notes</p>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className={inputClass}
                      placeholder="What did you find? What action did you take?"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setStatus(selected.id, "triaged")}
                      className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-[13px] font-medium text-white/90 hover:bg-white/[0.08] transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                    >
                      Mark triaged
                    </button>
                    <button
                      onClick={() => setStatus(selected.id, "actioned")}
                      className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2.5 text-[13px] font-medium text-emerald-200 hover:bg-emerald-500/25 transition-all shadow-[0_1px_0_rgba(34,197,94,0.2)_inset]"
                    >
                      Mark actioned
                    </button>
                    <button
                      onClick={() => setStatus(selected.id, "rejected")}
                      className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-[13px] font-medium text-white/90 hover:bg-white/[0.08] transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                    >
                      Reject
                    </button>
                  </div>

                  {(selected.target_type === "prompt" || selected.target_type === "workflow") && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-5 space-y-4 shadow-[inset_0_1px_0_rgba(251,191,36,0.08)]">
                      <p className={cardHeaderClass}>
                        Take down (removes from marketplace, reason shown to owner)
                      </p>
                      <textarea
                        value={takedownReason}
                        onChange={(e) => setTakedownReason(e.target.value)}
                        rows={2}
                        className={inputClass}
                        placeholder="Reason for takedown (shown to owner)"
                      />
                      <button
                        type="button"
                        onClick={takeDownListing}
                        disabled={takedownLoading || !takedownReason.trim()}
                        className="rounded-xl border border-amber-500/30 bg-amber-500/15 px-4 py-2.5 text-[13px] font-medium text-amber-200 hover:bg-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_1px_0_rgba(251,191,36,0.15)_inset]"
                      >
                        {takedownLoading ? "Taking down…" : "Take down"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Platform */}
      {section === "platform" && (
        <div className="space-y-6">
          <p className="text-[13px] text-white/50 max-w-xl">
            Control beta applications and platform-wide maintenance. Changes apply immediately.
          </p>

          <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
            <div className={`${cardClass} p-6`}>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-white">Applications</h3>
                  <p className="mt-1.5 text-[13px] text-white/50 leading-relaxed">
                    Pause or resume accepting beta applications.
                  </p>
                  {(appsPausedLoading || appsPausedSaving) && (
                    <p className="mt-2.5 text-[12px] text-white/40 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/80 animate-pulse" />
                      {appsPausedLoading ? "Loading…" : "Saving…"}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 sm:shrink-0">
                  <span
                    className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wide ${
                      appsPaused
                        ? "border-amber-400/25 bg-amber-500/15 text-amber-300/95"
                        : "border-emerald-400/25 bg-emerald-500/15 text-emerald-300/95"
                    }`}
                  >
                    {appsPaused ? "Paused" : "Accepting"}
                  </span>
                  <AdminToggle
                    checked={appsPaused}
                    onToggle={() => saveAppsPaused(!appsPaused)}
                    disabled={appsPausedLoading || appsPausedSaving}
                    labelOff="Pause"
                    labelOn="Resume"
                  />
                </div>
              </div>
            </div>

            <div className={`${cardClass} border-amber-500/15 bg-gradient-to-b from-amber-500/[0.06] to-amber-500/[0.02] p-6`}>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-white">Maintenance mode</h3>
                  <p className="mt-1.5 text-[13px] text-white/50 leading-relaxed">
                    Show &quot;Platform under maintenance&quot; on all pages except landing and admin.
                  </p>
                  <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-200/90 leading-relaxed shadow-[inset_0_1px_0_rgba(251,191,36,0.08)]">
                    <strong className="font-semibold text-amber-200">Warning:</strong> Enabling blocks marketplace, builder, prompt studio, and profiles. Only homepage and admin stay accessible.
                  </div>
                  {(maintenanceLoading || maintenanceSaving) && (
                    <p className="mt-2.5 text-[12px] text-white/40 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400/80 animate-pulse" />
                      {maintenanceLoading ? "Loading…" : "Saving…"}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 sm:shrink-0">
                  <span
                    className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wide ${
                      maintenanceMode
                        ? "border-amber-400/25 bg-amber-500/15 text-amber-300/95"
                        : "border-emerald-400/25 bg-emerald-500/15 text-emerald-300/95"
                    }`}
                  >
                    {maintenanceMode ? "On" : "Off"}
                  </span>
                  <AdminToggle
                    checked={maintenanceMode}
                    onToggle={() => saveMaintenanceMode(!maintenanceMode)}
                    disabled={maintenanceLoading || maintenanceSaving}
                    labelOff="Enable"
                    labelOn="Disable"
                    variant="warning"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tools */}
      {section === "tools" && (
        <div className="space-y-6">
          <p className="text-[13px] text-white/50 max-w-xl">
            Replenish demo runs, refill workflow runs (free run count), and manage user bans. Use after reviewing reports when needed.
          </p>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className={`${cardClass} p-6`}>
              <h3 className="text-[15px] font-semibold text-white">Replenish demo runs</h3>
              <p className="mt-1.5 text-[13px] text-white/50 leading-relaxed">
                Reset demo run limits for a user by username or handle.
              </p>
              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/45 mb-1.5">
                    Username / handle
                  </label>
                  <input
                    value={replenishUsername}
                    onChange={(e) => setReplenishUsername(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. username or @username"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !replenishLoading) replenishDemo();
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/45 mb-1.5">
                    Workflow ID (optional)
                  </label>
                  <input
                    value={replenishWorkflowId}
                    onChange={(e) => setReplenishWorkflowId(e.target.value)}
                    className={inputClass}
                    placeholder="Leave blank for all workflows"
                  />
                  <p className="mt-1.5 text-[12px] text-white/40">Leave blank to reset all demo runs for the user.</p>
                </div>
                <button
                  onClick={replenishDemo}
                  disabled={replenishLoading || !replenishUsername.trim()}
                  className="rounded-xl border border-amber-500/25 bg-amber-500/15 px-4 py-2.5 text-[13px] font-medium text-amber-200 hover:bg-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_1px_0_rgba(251,191,36,0.15)_inset]"
                >
                  {replenishLoading ? "Replenishing…" : "Replenish demo runs"}
                </button>
              </div>
            </div>

            <div className={`${cardClass} p-6`}>
              <h3 className="text-[15px] font-semibold text-white">Refill workflow runs</h3>
              <p className="mt-1.5 text-[13px] text-white/50 leading-relaxed">
                Reset workflow run count (free runs) for a user by username. Deletes their workflow_runs so they get their free runs back.
              </p>
              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/45 mb-1.5">
                    Username / handle
                  </label>
                  <input
                    value={refillWorkflowUsername}
                    onChange={(e) => setRefillWorkflowUsername(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. username or @username"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !refillWorkflowLoading) refillWorkflowRuns();
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/45 mb-1.5">
                    Workflow ID (optional)
                  </label>
                  <input
                    value={refillWorkflowId}
                    onChange={(e) => setRefillWorkflowId(e.target.value)}
                    className={inputClass}
                    placeholder="Leave blank for all workflows"
                  />
                  <p className="mt-1.5 text-[12px] text-white/40">Leave blank to reset run count for all workflows for this user.</p>
                </div>
                <button
                  onClick={refillWorkflowRuns}
                  disabled={refillWorkflowLoading || !refillWorkflowUsername.trim()}
                  className="rounded-xl border border-emerald-500/25 bg-emerald-500/15 px-4 py-2.5 text-[13px] font-medium text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_1px_0_rgba(34,197,94,0.2)_inset]"
                >
                  {refillWorkflowLoading ? "Refilling…" : "Refill workflow runs"}
                </button>
              </div>
            </div>

            <div className={`${cardClass} p-6`}>
              <h3 className="text-[15px] font-semibold text-white">Ban / unban user</h3>
              <p className="mt-1.5 text-[13px] text-white/50 leading-relaxed">
                Ban or unban by user ID (e.g. from a report). Uses <code className="rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[12px] font-mono text-white/70">admin_set_ban</code>.
              </p>
              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/45 mb-1.5">User ID</label>
                  <input
                    value={banUserId}
                    onChange={(e) => setBanUserId(e.target.value)}
                    className={inputClass}
                    placeholder="UUID"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/45 mb-1.5">
                    Ban expires at (optional)
                  </label>
                  <input
                    value={banExpiresAt}
                    onChange={(e) => setBanExpiresAt(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. 2026-02-01T12:00"
                  />
                  <p className="mt-1.5 text-[12px] text-white/40">Leave blank for permanent ban.</p>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/45 mb-1.5">Reason (optional)</label>
                  <input
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Scam / IP theft / harassment"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => banOrUnban(true)}
                    className="rounded-xl border border-red-500/30 bg-red-500/15 px-4 py-2.5 text-[13px] font-medium text-red-200 hover:bg-red-500/25 transition-all shadow-[0_1px_0_rgba(239,68,68,0.2)_inset]"
                  >
                    Ban user
                  </button>
                  <button
                    onClick={() => banOrUnban(false)}
                    className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-[13px] font-medium text-white/90 hover:bg-white/[0.08] transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                  >
                    Unban user
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

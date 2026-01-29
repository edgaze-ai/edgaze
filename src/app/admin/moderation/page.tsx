"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  // Product details (for prompts/workflows)
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
  // Adjust these routes if your app differs.
  if (r.target_type === "prompt") {
    if (ownerHandle && edgazeCode) return `/p/${ownerHandle}/${edgazeCode}`;
    return `/p/${r.target_id}`;
  }
  if (r.target_type === "workflow") {
    if (ownerHandle && edgazeCode) return `/${ownerHandle}/${edgazeCode}`;
    return `/${r.target_id}`;
  }
  if (r.target_type === "comment") return `/admin/moderation?focus=${r.id}`; // comments need context; keep in admin
  return `/u/${r.target_id}`; // user profile
}

export default function AdminModerationPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { authReady, userId } = useAuth();

  const [tab, setTab] = useState<"open" | "triaged" | "all">("open");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [selected, setSelected] = useState<ReportRow | null>(null);

  const [notes, setNotes] = useState("");
  const [banUserId, setBanUserId] = useState("");
  const [banReason, setBanReason] = useState("");
  const [banExpiresAt, setBanExpiresAt] = useState<string>(""); // ISO-ish from input
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Demo replenish state
  const [replenishUsername, setReplenishUsername] = useState("");
  const [replenishWorkflowId, setReplenishWorkflowId] = useState("");
  const [replenishLoading, setReplenishLoading] = useState(false);

  // Applications pause toggle
  const [appsPausedLoading, setAppsPausedLoading] = useState(true);
  const [appsPausedSaving, setAppsPausedSaving] = useState(false);
  const [appsPaused, setAppsPaused] = useState(false);

  // Maintenance mode toggle (platform-wide, except landing + admin)
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  async function loadAppsPaused() {
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
      // If settings table missing, default to "not paused" and keep admin functional
      setAppsPaused(false);
    } finally {
      setAppsPausedLoading(false);
    }
  }

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

  async function loadMaintenanceMode() {
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
  }

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

  async function load() {
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
    
    // Enrich reports with product details for prompts/workflows
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
  }

  useEffect(() => {
    if (!authReady || !userId) return;
    load();
    loadAppsPaused();
    loadMaintenanceMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, userId, tab]);

  // realtime subscribe so admin UI also flips instantly if changed elsewhere
  useEffect(() => {
    const chApps = supabase
      .channel("realtime:app_settings:applications_paused_admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: "key=eq.applications_paused" },
        (payload: any) => {
          const next = Boolean(payload?.new?.value);
          setAppsPaused(next);
        }
      )
      .subscribe();

    const chMaint = supabase
      .channel("realtime:app_settings:maintenance_mode_admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: "key=eq.maintenance_mode" },
        (payload: any) => {
          const next = Boolean(payload?.new?.value);
          setMaintenanceMode(next);
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(chApps);
        supabase.removeChannel(chMaint);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enable scrolling on admin/moderation (same as help page)
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
      const response = await fetch("/api/admin/replenish-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  function pick(r: ReportRow) {
    setSelected(r);
    setNotes(r.admin_notes || "");
    // prefill ban user id with target user if it’s a user report; otherwise blank
    setBanUserId(r.target_type === "user" ? r.target_id : "");
    setBanReason("");
    setBanExpiresAt("");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Reports</div>
          <div className="text-sm text-white/60">Review reports. Action reports. Ban users when necessary.</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab("open")}
            className={`text-sm px-3 py-2 rounded-xl border ${
              tab === "open" ? "bg-white/10 border-white/20" : "bg-white/5 border-white/10 hover:bg-white/10"
            }`}
          >
            Open
          </button>
          <button
            onClick={() => setTab("triaged")}
            className={`text-sm px-3 py-2 rounded-xl border ${
              tab === "triaged" ? "bg-white/10 border-white/20" : "bg-white/5 border-white/10 hover:bg-white/10"
            }`}
          >
            Triaged
          </button>
          <button
            onClick={() => setTab("all")}
            className={`text-sm px-3 py-2 rounded-xl border ${
              tab === "all" ? "bg-white/10 border-white/20" : "bg-white/5 border-white/10 hover:bg-white/10"
            }`}
          >
            All
          </button>

          <button
            onClick={load}
            className="text-sm px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Applications toggle panel */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold">Applications</div>
            <div className="text-sm text-white/60">Pause/resume accepting closed beta applications.</div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`text-xs px-2 py-1 rounded-full border ${
                appsPaused
                  ? "border-amber-400/30 text-amber-200 bg-amber-500/10"
                  : "border-emerald-400/30 text-emerald-200 bg-emerald-500/10"
              }`}
            >
              {appsPaused ? "Paused" : "Accepting"}
            </div>

            <button
              disabled={appsPausedLoading || appsPausedSaving}
              onClick={() => saveAppsPaused(!appsPaused)}
              className={`relative inline-flex h-10 w-[120px] items-center rounded-2xl border transition-colors ${
                appsPaused
                  ? "bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15"
                  : "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15"
              } ${appsPausedLoading || appsPausedSaving ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <span className="absolute left-3 text-xs font-semibold text-white/80">
                {appsPaused ? "Resume" : "Pause"}
              </span>
              <span
                className={`absolute right-2 h-7 w-7 rounded-xl border bg-black/30 transition-transform ${
                  appsPaused ? "translate-x-0 border-amber-500/30" : "translate-x-0 border-emerald-500/30"
                }`}
              />
              <span
                className={`absolute right-2 h-7 w-7 rounded-xl bg-white/10 transition-transform ${
                  appsPaused ? "-translate-x-[74px]" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {appsPausedLoading ? <div className="mt-3 text-xs text-white/50">Loading applications state…</div> : null}
        {appsPausedSaving ? <div className="mt-1 text-xs text-white/50">Saving…</div> : null}
      </div>

      {/* Maintenance mode panel */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-base font-semibold">Maintenance mode</div>
            <div className="text-sm text-white/60 mt-0.5">
              Show &quot;Platform under maintenance&quot; on all pages except landing and admin. Use with caution.
            </div>
            <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200">
              <span className="font-medium">Warning:</span> Enabling this blocks marketplace, builder, prompt studio, profiles, and all other app routes. Only the homepage and admin stay accessible.
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`text-xs px-2 py-1 rounded-full border ${
                maintenanceMode
                  ? "border-amber-400/30 text-amber-200 bg-amber-500/10"
                  : "border-emerald-400/30 text-emerald-200 bg-emerald-500/10"
              }`}
            >
              {maintenanceMode ? "On" : "Off"}
            </div>

            <button
              disabled={maintenanceLoading || maintenanceSaving}
              onClick={() => saveMaintenanceMode(!maintenanceMode)}
              className={`relative inline-flex h-10 w-[120px] items-center rounded-2xl border transition-colors ${
                maintenanceMode
                  ? "bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15"
                  : "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15"
              } ${maintenanceLoading || maintenanceSaving ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <span className="absolute left-3 text-xs font-semibold text-white/80">
                {maintenanceMode ? "Disable" : "Enable"}
              </span>
              <span
                className={`absolute right-2 h-7 w-7 rounded-xl border bg-black/30 transition-transform ${
                  maintenanceMode ? "translate-x-0 border-amber-500/30" : "translate-x-0 border-emerald-500/30"
                }`}
              />
              <span
                className={`absolute right-2 h-7 w-7 rounded-xl bg-white/10 transition-transform ${
                  maintenanceMode ? "-translate-x-[74px]" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {maintenanceLoading ? <div className="mt-3 text-xs text-white/50">Loading maintenance state…</div> : null}
        {maintenanceSaving ? <div className="mt-1 text-xs text-white/50">Saving…</div> : null}
      </div>

      {actionMsg ? (
        <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
          {actionMsg}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left list */}
        <div className="lg:col-span-1 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="text-sm font-semibold">Queue</div>
            <div className="text-xs text-white/50">{rows.length}</div>
          </div>

          {loading ? (
            <div className="px-4 py-6 text-sm text-white/60">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-white/60">No reports.</div>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto">
              {rows.map((r) => {
                const active = selected?.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => pick(r)}
                    className={`w-full text-left px-4 py-3 border-b border-white/10 hover:bg-white/10 ${
                      active ? "bg-white/10" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">
                        {r.target_type} • {r.reason}
                      </div>
                      <div
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          r.status === "open"
                            ? "border-cyan-400/30 text-cyan-200 bg-cyan-500/10"
                            : r.status === "triaged"
                            ? "border-purple-400/30 text-purple-200 bg-purple-500/10"
                            : r.status === "actioned"
                            ? "border-emerald-400/30 text-emerald-200 bg-emerald-500/10"
                            : "border-white/15 text-white/60 bg-white/5"
                        }`}
                      >
                        {r.status}
                      </div>
                    </div>
                    <div className="text-xs text-white/50 mt-1">{fmt(r.created_at)}</div>
                    {r.details ? <div className="text-xs text-white/60 mt-1 line-clamp-2">{r.details}</div> : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right detail */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            {!selected ? (
              <div className="text-sm text-white/60">Select a report.</div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold">{selected.target_type} reported</div>
                    <div className="text-xs text-white/50">
                      Reported {fmt(selected.created_at)} • reporter {selected.reporter_id}
                    </div>
                  </div>

                  <a
                    href={targetHref(selected, selected.target_owner_handle, selected.target_edgaze_code)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
                  >
                    Open target
                  </a>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-xs text-white/50">Target</div>
                    <div className="text-sm mt-1">
                      <span className="text-white/70">{selected.target_type}</span>
                      {(selected.target_type === "prompt" || selected.target_type === "workflow") && selected.target_title && (
                        <div className="text-sm font-semibold text-white/90 mt-1">
                          {selected.target_title}
                        </div>
                      )}
                      {selected.target_owner_handle && (
                        <div className="text-xs text-white/60 mt-1">
                          by @{selected.target_owner_handle}
                          {selected.target_owner_name && ` (${selected.target_owner_name})`}
                        </div>
                      )}
                      {selected.target_edgaze_code && (
                        <div className="text-xs text-white/50 mt-1">
                          Code: {selected.target_edgaze_code}
                        </div>
                      )}
                      <div className="text-xs text-white/40 mt-1 break-all">{selected.target_id}</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-xs text-white/50">Reason</div>
                    <div className="text-sm mt-1">{selected.reason}</div>
                  </div>
                </div>

                {selected.details ? (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-xs text-white/50">Details</div>
                    <div className="text-sm mt-1 whitespace-pre-wrap">{selected.details}</div>
                  </div>
                ) : null}

                {selected.evidence_urls && selected.evidence_urls.length > 0 ? (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-xs text-white/50">Evidence</div>
                    <div className="text-sm mt-2 space-y-1">
                      {selected.evidence_urls.map((u) => (
                        <a key={u} href={u} target="_blank" rel="noreferrer" className="block text-cyan-200 hover:underline break-all">
                          {u}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs text-white/50 mb-2">Admin notes</div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm outline-none focus:border-white/20"
                    placeholder="What did you find? What action did you take?"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setStatus(selected.id, "triaged")}
                    className="text-sm px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
                  >
                    Mark triaged
                  </button>
                  <button
                    onClick={() => setStatus(selected.id, "actioned")}
                    className="text-sm px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/20 border border-emerald-500/25"
                  >
                    Mark actioned
                  </button>
                  <button
                    onClick={() => setStatus(selected.id, "rejected")}
                    className="text-sm px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Demo Replenish panel */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-base font-semibold">Replenish Demo Runs</div>
                <div className="text-sm text-white/60">
                  Reset demo run limits for a user by username/handle.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-white/50 mb-1">Username / Handle</div>
                <input
                  value={replenishUsername}
                  onChange={(e) => setReplenishUsername(e.target.value)}
                  className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm outline-none focus:border-white/20"
                  placeholder="e.g. username or @username"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !replenishLoading) {
                      replenishDemo();
                    }
                  }}
                />
              </div>

              <div>
                <div className="text-xs text-white/50 mb-1">Workflow ID (optional)</div>
                <input
                  value={replenishWorkflowId}
                  onChange={(e) => setReplenishWorkflowId(e.target.value)}
                  className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm outline-none focus:border-white/20"
                  placeholder="Leave blank for all workflows"
                />
                <div className="text-xs text-white/40 mt-1">Leave blank to reset all demo runs for user.</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={replenishDemo}
                disabled={replenishLoading || !replenishUsername.trim()}
                className="text-sm px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/20 border border-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {replenishLoading ? "Replenishing..." : "Replenish Demo Runs"}
              </button>
            </div>
          </div>

          {/* Ban panel */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-base font-semibold">Ban / Unban</div>
                <div className="text-sm text-white/60">
                  Uses RPC <span className="text-white/70">admin_set_ban</span>.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-white/50 mb-1">User ID</div>
                <input
                  value={banUserId}
                  onChange={(e) => setBanUserId(e.target.value)}
                  className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm outline-none focus:border-white/20"
                  placeholder="uuid"
                />
              </div>

              <div>
                <div className="text-xs text-white/50 mb-1">Ban expires at (optional)</div>
                <input
                  value={banExpiresAt}
                  onChange={(e) => setBanExpiresAt(e.target.value)}
                  className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm outline-none focus:border-white/20"
                  placeholder="e.g. 2026-02-01T12:00"
                />
                <div className="text-xs text-white/40 mt-1">Leave blank for permanent ban.</div>
              </div>

              <div className="md:col-span-2">
                <div className="text-xs text-white/50 mb-1">Reason (optional)</div>
                <input
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm outline-none focus:border-white/20"
                  placeholder="e.g. Scam / IP theft / harassment"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={() => banOrUnban(true)}
                className="text-sm px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/20 border border-red-500/25"
              >
                Ban user
              </button>
              <button
                onClick={() => banOrUnban(false)}
                className="text-sm px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
              >
                Unban user
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

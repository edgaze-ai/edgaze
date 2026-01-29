"use client";

import React, { useState, useEffect } from "react";
import { X, AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { cx } from "../../lib/cx";
import { useAuth } from "../auth/AuthContext";

export type RunDiagnosticData = {
  workflowId: string;
  userId: string;
  currentCount: number;
  limit: number;
  lastRunId: string | null;
  lastRunStatus: string | null;
  lastRunCreatedAt: string | null;
  lastRunUpdatedAt: string | null;
  error: string | null;
};

export type TrackingDiagnosticData = {
  userId: string;
  workflowId: string;
  envCheck: { serviceRoleKey: string; supabaseUrl: string };
  countRpc: { value: number | null; error: string | null };
  countDirect: { value: number | null; error: string | null };
  recentRuns: { rows: { id: string; status: string; completed_at: string | null; created_at: string }[]; error: string | null };
  testInsertResult: {
    createOk: boolean;
    createError: string | null;
    createErrorDetails?: { code?: string; details?: string; hint?: string };
    updateOk: boolean;
    updateError: string | null;
    updateErrorDetails?: { code?: string; details?: string; hint?: string };
    runId: string | null;
  } | null;
  summary: string[];
};

export default function RunCountDiagnosticModal({
  open,
  onClose,
  workflowId,
  onRefresh,
}: {
  open: boolean;
  onClose: () => void;
  workflowId: string | null;
  onRefresh?: () => void;
}) {
  const { getAccessToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [diagnostic, setDiagnostic] = useState<RunDiagnosticData | null>(null);
  const [tracking, setTracking] = useState<TrackingDiagnosticData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testInsertLoading, setTestInsertLoading] = useState(false);

  const headersWithAuth = async (): Promise<HeadersInit> => {
    const accessToken = await getAccessToken();
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    return headers;
  };

  const fetchDiagnostic = async (withTestInsert = false) => {
    if (!workflowId) return;

    setLoading(true);
    setError(null);
    if (withTestInsert) setTestInsertLoading(true);

    try {
      const headers = await headersWithAuth();
      const [diagRes, trackRes] = await Promise.all([
        fetch(`/api/flow/run/diagnostic?workflowId=${encodeURIComponent(workflowId)}`, { method: "GET", headers, credentials: "include" }),
        fetch(`/api/flow/run/tracking-diagnostic?workflowId=${encodeURIComponent(workflowId)}${withTestInsert ? "&testInsert=1" : ""}`, { method: "GET", headers, credentials: "include" }),
      ]);

      if (!diagRes.ok) {
        const data = await diagRes.json().catch(() => ({}));
        throw new Error(data.error || `Diagnostic ${diagRes.status}`);
      }
      const diagData = await diagRes.json();
      if (diagData.ok) setDiagnostic(diagData.diagnostic);

      if (!trackRes.ok) {
        const data = await trackRes.json().catch(() => ({}));
        throw new Error(data.error || `Tracking diagnostic ${trackRes.status}`);
      }
      const trackData = await trackRes.json();
      if (trackData.ok) setTracking(trackData.tracking);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load diagnostic");
    } finally {
      setLoading(false);
      setTestInsertLoading(false);
    }
  };

  const runTestInsert = () => fetchDiagnostic(true);

  useEffect(() => {
    if (open && workflowId) {
      fetchDiagnostic();
    }
  }, [open, workflowId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-white/20 bg-black/95 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.4)] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Run Count Diagnostic</h2>
            <p className="text-sm text-white/60 mt-1">Debug information about workflow run tracking</p>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-lg border border-white/12 bg-white/5 hover:bg-white/10 grid place-items-center transition-all duration-200"
          >
            <X className="h-4 w-4 text-white/85" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            </div>
          ) : error ? (
            <div className="rounded-xl border-2 border-red-500/40 bg-red-500/10 p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-lg font-semibold text-red-300 mb-2">Error</div>
                  <div className="text-sm text-red-200/90">{error}</div>
                </div>
              </div>
            </div>
          ) : diagnostic ? (
            <>
              {/* Current Count */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Current Run Count</h3>
                  <button
                    onClick={() => void fetchDiagnostic()}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-sm font-medium text-white/85 transition-all duration-200"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-white/50 mb-1">Used Runs</div>
                    <div className="text-2xl font-bold text-white">{diagnostic.currentCount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-white/50 mb-1">Limit</div>
                    <div className="text-2xl font-bold text-white">{diagnostic.limit}</div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="text-xs text-white/50 mb-1">Remaining</div>
                  <div className="text-xl font-semibold text-cyan-400">
                    {Math.max(0, diagnostic.limit - diagnostic.currentCount)} runs
                  </div>
                </div>
              </div>

              {/* Last Run Info */}
              {diagnostic.lastRunId ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <h3 className="text-lg font-semibold text-white mb-4">Last Run</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-white/50 mb-1">Run ID</div>
                      <div className="text-sm font-mono text-white/80 break-all">{diagnostic.lastRunId}</div>
                    </div>
                    <div>
                      <div className="text-xs text-white/50 mb-1">Status</div>
                      <div className="inline-flex items-center gap-2">
                        {diagnostic.lastRunStatus === "completed" ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-400" />
                            <span className="text-sm font-medium text-green-400">Completed</span>
                          </>
                        ) : diagnostic.lastRunStatus === "failed" ? (
                          <>
                            <AlertTriangle className="h-4 w-4 text-red-400" />
                            <span className="text-sm font-medium text-red-400">Failed</span>
                          </>
                        ) : diagnostic.lastRunStatus === "running" ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />
                            <span className="text-sm font-medium text-yellow-400">Running (Stuck?)</span>
                          </>
                        ) : (
                          <span className="text-sm font-medium text-white/70">{diagnostic.lastRunStatus || "Unknown"}</span>
                        )}
                      </div>
                    </div>
                    {diagnostic.lastRunCreatedAt && (
                      <div>
                        <div className="text-xs text-white/50 mb-1">Created At</div>
                        <div className="text-sm text-white/80">
                          {new Date(diagnostic.lastRunCreatedAt).toLocaleString()}
                        </div>
                      </div>
                    )}
                    {diagnostic.lastRunUpdatedAt && (
                      <div>
                        <div className="text-xs text-white/50 mb-1">Last Updated</div>
                        <div className="text-sm text-white/80">
                          {new Date(diagnostic.lastRunUpdatedAt).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {diagnostic.lastRunStatus === "running" && (
                    <div className="mt-4 pt-4 border-t border-white/10 rounded-lg border-yellow-500/40 bg-yellow-500/10 p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-yellow-300 mb-1">Warning: Stuck Run</div>
                          <div className="text-xs text-yellow-200/80">
                            Your last run is still marked as "running". This might prevent the count from updating correctly.
                            The run may have completed but failed to update its status in the database.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="text-sm text-white/60">No runs recorded yet</div>
                </div>
              )}

              {/* Potential Issues */}
              {diagnostic.error && (
                <div className="rounded-xl border-2 border-red-500/40 bg-red-500/10 p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-red-300 mb-1">Tracking Error</div>
                      <div className="text-xs text-red-200/80 font-mono">{diagnostic.error}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Why usage isn't increasing - tracking diagnostic */}
              {tracking && (
                <div className="rounded-xl border-2 border-cyan-500/30 bg-cyan-500/5 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Why usage isn&apos;t increasing</h3>
                    <button
                      type="button"
                      onClick={runTestInsert}
                      disabled={testInsertLoading}
                      className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-400/10 hover:bg-cyan-400/20 px-3 py-1.5 text-sm font-medium text-cyan-300 transition-all disabled:opacity-50"
                    >
                      {testInsertLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Test insert + update
                    </button>
                  </div>
                  {/* Env */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-white/50">Service role key: </span>
                      <span className={tracking.envCheck.serviceRoleKey === "missing" ? "text-red-400 font-medium" : "text-green-400"}>
                        {tracking.envCheck.serviceRoleKey}
                      </span>
                    </div>
                    <div>
                      <span className="text-white/50">Supabase URL: </span>
                      <span className={tracking.envCheck.supabaseUrl === "missing" ? "text-red-400" : "text-green-400"}>
                        {tracking.envCheck.supabaseUrl}
                      </span>
                    </div>
                  </div>
                  {/* Count: RPC vs direct */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="rounded-lg bg-white/5 p-3">
                      <div className="text-white/50 mb-1">Count (RPC)</div>
                      {tracking.countRpc.error ? (
                        <div className="text-red-400 font-mono text-xs break-all">{tracking.countRpc.error}</div>
                      ) : (
                        <div className="text-white font-mono">{tracking.countRpc.value ?? "—"}</div>
                      )}
                    </div>
                    <div className="rounded-lg bg-white/5 p-3">
                      <div className="text-white/50 mb-1">Count (direct query)</div>
                      {tracking.countDirect.error ? (
                        <div className="text-red-400 font-mono text-xs break-all">{tracking.countDirect.error}</div>
                      ) : (
                        <div className="text-white font-mono">{tracking.countDirect.value ?? "—"}</div>
                      )}
                    </div>
                  </div>
                  {/* Recent runs */}
                  <div>
                    <div className="text-white/50 text-sm mb-2">Recent runs (last 20)</div>
                    {tracking.recentRuns.error ? (
                      <div className="text-red-400 text-sm font-mono">{tracking.recentRuns.error}</div>
                    ) : tracking.recentRuns.rows.length === 0 ? (
                      <div className="text-white/60 text-sm">No rows — inserts may be failing (RLS or missing key).</div>
                    ) : (
                      <div className="rounded-lg border border-white/10 overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-white/5 text-left text-white/70">
                              <th className="p-2">Status</th>
                              <th className="p-2">completed_at</th>
                              <th className="p-2">created_at</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tracking.recentRuns.rows.slice(0, 10).map((r) => (
                              <tr key={r.id} className="border-t border-white/5 text-white/80">
                                <td className="p-2">
                                  <span className={r.status === "completed" || r.status === "failed" ? "text-green-400" : "text-yellow-400"}>
                                    {r.status}
                                  </span>
                                </td>
                                <td className="p-2 font-mono">{r.completed_at ? new Date(r.completed_at).toLocaleString() : "—"}</td>
                                <td className="p-2 font-mono">{new Date(r.created_at).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {tracking.recentRuns.rows.length > 10 && (
                          <div className="p-2 text-white/50 text-xs border-t border-white/5">
                            +{tracking.recentRuns.rows.length - 10} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Test insert result */}
                  {tracking.testInsertResult && (
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
                      <div className="font-medium text-white/90 mb-2">Test insert result</div>
                      <div className="space-y-2 text-white/70">
                        <div>
                          <span className="text-white/50">Create: </span>
                          {tracking.testInsertResult.createOk ? (
                            <span className="text-green-400">OK</span>
                          ) : (
                            <div className="mt-1">
                              <div className="text-red-400 font-mono text-xs break-all">{tracking.testInsertResult.createError}</div>
                              {tracking.testInsertResult.createErrorDetails && (
                                <div className="mt-1 text-red-300/80 text-xs">
                                  {tracking.testInsertResult.createErrorDetails.code && <div>Code: {tracking.testInsertResult.createErrorDetails.code}</div>}
                                  {tracking.testInsertResult.createErrorDetails.details && <div>Details: {tracking.testInsertResult.createErrorDetails.details}</div>}
                                  {tracking.testInsertResult.createErrorDetails.hint && <div>Hint: {tracking.testInsertResult.createErrorDetails.hint}</div>}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div>
                          <span className="text-white/50">Update to failed: </span>
                          {tracking.testInsertResult.updateOk ? (
                            <span className="text-green-400">OK</span>
                          ) : (
                            <div className="mt-1">
                              {tracking.testInsertResult.updateError ? (
                                <>
                                  <div className="text-red-400 font-mono text-xs break-all">{tracking.testInsertResult.updateError}</div>
                                  {tracking.testInsertResult.updateErrorDetails && (
                                    <div className="mt-1 text-red-300/80 text-xs">
                                      {tracking.testInsertResult.updateErrorDetails.code && <div>Code: {tracking.testInsertResult.updateErrorDetails.code}</div>}
                                      {tracking.testInsertResult.updateErrorDetails.details && <div>Details: {tracking.testInsertResult.updateErrorDetails.details}</div>}
                                      {tracking.testInsertResult.updateErrorDetails.hint && <div>Hint: {tracking.testInsertResult.updateErrorDetails.hint}</div>}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <span className="text-white/50">—</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Summary */}
                  <div className="pt-2 border-t border-white/10">
                    <div className="text-white/50 text-sm mb-2">Summary</div>
                    {tracking.summary.length === 0 ? (
                      <div className="text-white/60 text-sm">No issues detected from this diagnostic.</div>
                    ) : (
                      <ul className="list-disc list-inside space-y-1 text-sm text-white/80">
                        {tracking.summary.map((s, i) => (
                          <li key={i} className="text-amber-200/90">{s}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* Fallback why count might not update (when tracking not loaded) */}
              {!tracking && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <h3 className="text-lg font-semibold text-white mb-4">Why Count Might Not Update</h3>
                  <div className="space-y-3 text-sm text-white/70">
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 shrink-0" />
                      <div>
                        <div className="font-medium text-white/90 mb-1">Runs only count when status is &quot;completed&quot; or &quot;failed&quot;</div>
                        <div className="text-xs text-white/50">If a run is stuck in &quot;running&quot; or &quot;pending&quot;, it won&apos;t be counted.</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 shrink-0" />
                      <div>
                        <div className="font-medium text-white/90 mb-1">Database update must succeed</div>
                        <div className="text-xs text-white/50">If the database update fails after workflow execution, the count won&apos;t increment.</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3">
          {onRefresh && (
            <button
              onClick={() => {
                onRefresh();
                fetchDiagnostic();
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm font-medium text-white/85 transition-all duration-200"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh & Retry
            </button>
          )}
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm font-medium text-white/85 transition-all duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

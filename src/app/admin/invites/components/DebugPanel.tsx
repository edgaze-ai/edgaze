"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Bug, Copy, Check } from "lucide-react";

export default function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [token, setToken] = useState("");
  const [debugData, setDebugData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [allInvites, setAllInvites] = useState<any>(null);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [dbCheck, setDbCheck] = useState<any>(null);
  const [loadingDbCheck, setLoadingDbCheck] = useState(false);
  const [migrations, setMigrations] = useState<any>(null);
  const [loadingMigrations, setLoadingMigrations] = useState(false);

  const handleDebug = async () => {
    if (!token) return;

    setLoading(true);
    try {
      const response = await fetch("/api/admin/debug-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      setDebugData(data);
    } catch (err: any) {
      setDebugData({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDebug = () => {
    navigator.clipboard.writeText(JSON.stringify(debugData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLoadAllInvites = async () => {
    setLoadingInvites(true);
    try {
      console.warn("[Debug Panel] Fetching all invites...");
      const response = await fetch("/api/admin/list-invites");
      console.warn("[Debug Panel] Response status:", response.status);
      const data = await response.json();
      console.warn("[Debug Panel] Response data:", data);
      setAllInvites(data);
    } catch (err: any) {
      console.error("[Debug Panel] Fetch failed:", err);
      setAllInvites({ error: err.message });
    } finally {
      setLoadingInvites(false);
    }
  };

  const handleCheckDatabase = async () => {
    setLoadingDbCheck(true);
    try {
      console.warn("[Debug Panel] Checking database health...");
      const response = await fetch("/api/admin/check-db");
      console.warn("[Debug Panel] Health check response status:", response.status);
      const data = await response.json();
      console.warn("[Debug Panel] Health check data:", data);
      setDbCheck(data);
    } catch (err: any) {
      console.error("[Debug Panel] Health check failed:", err);
      setDbCheck({ error: err.message });
    } finally {
      setLoadingDbCheck(false);
    }
  };

  const handleShowMigrations = async () => {
    setLoadingMigrations(true);
    try {
      const response = await fetch("/api/admin/apply-migrations");
      const data = await response.json();
      setMigrations(data);
    } catch (err: any) {
      setMigrations({ error: err.message });
    } finally {
      setLoadingMigrations(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-amber-500/10"
      >
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-semibold text-amber-400">Admin Debug Panel</span>
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
            Admin Only
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-amber-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-amber-400" />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-amber-500/20 p-4 space-y-4">
          {/* Instructions */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-xs font-semibold text-amber-300 mb-1">How to use this panel:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-amber-200/80">
              <li>Create a new invite above (click &quot;Create Invite&quot;)</li>
              <li>Copy the token from the generated link</li>
              <li>Paste it below and click &quot;Debug&quot;</li>
              <li>Check if it shows &quot;FOUND&quot; - if not, there&apos;s a problem!</li>
            </ol>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-white/70">
              Test Token (paste the token part from invite URL)
            </label>
            <p className="mb-2 text-xs text-white/40">
              Example: From <code className="text-cyan-400">http://localhost:3000/c/ABC123...</code>{" "}
              paste just <code className="text-cyan-400">ABC123...</code>
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste token here (just the token, not the full URL)"
                className="flex-1 rounded-lg border border-white/[0.12] bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
              />
              <button
                onClick={handleDebug}
                disabled={!token || loading}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition-all hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Testing..." : "Debug"}
              </button>
            </div>
          </div>

          {debugData && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Debug Results</h3>
                <button
                  onClick={handleCopyDebug}
                  className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-xs text-white/70 transition-all hover:bg-white/[0.06]"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy JSON
                    </>
                  )}
                </button>
              </div>

              {debugData.error ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                  <p className="text-sm font-semibold text-red-400">Error</p>
                  <p className="mt-1 text-xs text-red-300">{debugData.error}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Token Info */}
                  <div className="rounded-lg border border-white/[0.08] bg-black/40 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                      Token Analysis
                    </p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-white/60">Length:</span>
                        <span className="font-mono text-white">
                          {debugData.debug?.token_length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Hash:</span>
                        <span className="font-mono text-xs text-cyan-400">
                          {debugData.debug?.token_hash?.substring(0, 20)}...
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Lookup by Hash */}
                  <div
                    className={`rounded-lg border p-3 ${
                      debugData.debug?.lookup_by_hash?.found
                        ? "border-green-500/30 bg-green-500/10"
                        : "border-red-500/30 bg-red-500/10"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                        Lookup by Hash
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          debugData.debug?.lookup_by_hash?.found
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {debugData.debug?.lookup_by_hash?.found ? "FOUND" : "NOT FOUND"}
                      </span>
                    </div>
                    {debugData.debug?.lookup_by_hash?.invite && (
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-white/60">Creator:</span>
                          <span className="text-white">
                            {debugData.debug.lookup_by_hash.invite.creator_name}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Status:</span>
                          <span
                            className={`font-semibold ${
                              debugData.debug.lookup_by_hash.invite.status === "active"
                                ? "text-cyan-400"
                                : "text-amber-400"
                            }`}
                          >
                            {debugData.debug.lookup_by_hash.invite.status}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Has Raw Token:</span>
                          <span
                            className={
                              debugData.debug.lookup_by_hash.invite.has_raw_token
                                ? "text-green-400"
                                : "text-red-400"
                            }
                          >
                            {debugData.debug.lookup_by_hash.invite.has_raw_token ? "Yes" : "No"}
                          </span>
                        </div>
                      </div>
                    )}
                    {debugData.debug?.lookup_by_hash?.error && (
                      <p className="text-xs text-red-300">{debugData.debug.lookup_by_hash.error}</p>
                    )}
                  </div>

                  {/* Lookup by Raw Token */}
                  <div
                    className={`rounded-lg border p-3 ${
                      debugData.debug?.lookup_by_raw_token?.found
                        ? "border-green-500/30 bg-green-500/10"
                        : "border-red-500/30 bg-red-500/10"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                        Lookup by Raw Token
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          debugData.debug?.lookup_by_raw_token?.found
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {debugData.debug?.lookup_by_raw_token?.found ? "FOUND" : "NOT FOUND"}
                      </span>
                    </div>
                    {debugData.debug?.lookup_by_raw_token?.invite && (
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-white/60">Creator:</span>
                          <span className="text-white">
                            {debugData.debug.lookup_by_raw_token.invite.creator_name}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Status:</span>
                          <span
                            className={`font-semibold ${
                              debugData.debug.lookup_by_raw_token.invite.status === "active"
                                ? "text-cyan-400"
                                : "text-amber-400"
                            }`}
                          >
                            {debugData.debug.lookup_by_raw_token.invite.status}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recent Invites */}
                  <div className="rounded-lg border border-white/[0.08] bg-black/40 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                      Recent Invites (for comparison)
                    </p>
                    {!debugData.debug?.recent_invites ||
                    debugData.debug.recent_invites.length === 0 ? (
                      <p className="text-xs text-white/40">No invites found in database</p>
                    ) : (
                      <div className="space-y-2">
                        {debugData.debug.recent_invites.map((inv: any) => (
                          <div
                            key={inv.id}
                            className={`rounded border p-2 text-xs ${
                              inv.matches_search
                                ? "border-green-500/30 bg-green-500/10"
                                : "border-white/[0.06] bg-white/[0.02]"
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold text-white">{inv.creator_name}</span>
                              <div className="flex gap-2 items-center">
                                {inv.matches_search && (
                                  <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-semibold text-green-400">
                                    MATCH
                                  </span>
                                )}
                                <span
                                  className={`text-xs ${inv.status === "active" ? "text-cyan-400" : "text-white/40"}`}
                                >
                                  {inv.status}
                                </span>
                              </div>
                            </div>
                            <div className="mt-1 space-y-0.5 text-white/50">
                              <div className="flex justify-between">
                                <span>Raw Token:</span>
                                <span className="font-mono text-[10px]">
                                  {inv.has_raw_token ? inv.raw_token_preview : "✗ Missing"}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Hash:</span>
                                <span className="font-mono text-[10px]">
                                  {inv.token_hash_preview}
                                </span>
                              </div>
                            </div>
                            {inv.has_raw_token && inv.raw_token && (
                              <button
                                onClick={() => {
                                  setToken(inv.raw_token);
                                  handleDebug();
                                }}
                                className="mt-2 w-full rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-medium text-cyan-400 transition-all hover:bg-cyan-500/20"
                              >
                                Test this token
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Database Check Buttons */}
          <div className="pt-4 border-t border-amber-500/20 space-y-2">
            {dbCheck?.database_check?.table_exists === false && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 mb-2">
                <p className="text-sm font-semibold text-red-400 mb-1">⚠️ Table Missing!</p>
                <p className="text-xs text-red-300 mb-2">
                  The creator_invites table doesn&apos;t exist. You need to run the migrations.
                </p>
                <button
                  onClick={handleShowMigrations}
                  disabled={loadingMigrations}
                  className="w-full rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingMigrations ? "Loading..." : "📋 Show Migration SQL to Run"}
                </button>
              </div>
            )}
            <button
              onClick={handleCheckDatabase}
              disabled={loadingDbCheck}
              className="w-full rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingDbCheck ? "Checking..." : "🔴 Check Database Health"}
            </button>
            <button
              onClick={handleLoadAllInvites}
              disabled={loadingInvites}
              className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition-all hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingInvites ? "Loading..." : "🔍 Show All Invites in Database"}
            </button>
            <p className="text-xs text-amber-300/80 text-center">
              Click these to see what&apos;s actually in your database
            </p>
          </div>

          {/* Database Health Check Results */}
          {dbCheck && (
            <div className="pt-4 border-t border-amber-500/20">
              <h3 className="text-sm font-semibold text-white mb-2">Database Health Check</h3>
              {dbCheck.error ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                  <p className="text-sm font-semibold text-red-400">Error</p>
                  <p className="text-xs text-red-300 mt-1">{dbCheck.error}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-lg border border-white/[0.08] bg-black/40 p-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/60">Table Exists:</span>
                      <span
                        className={
                          dbCheck.database_check?.table_exists
                            ? "text-green-400 font-semibold"
                            : "text-red-400 font-semibold"
                        }
                      >
                        {dbCheck.database_check?.table_exists ? "Yes ✓" : "No ✗"}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-white/60">Total Invites:</span>
                      <span className="text-white font-semibold">
                        {dbCheck.database_check?.total_invites || 0}
                      </span>
                    </div>
                    {dbCheck.database_check?.query_error && (
                      <div className="mt-2 pt-2 border-t border-white/[0.08]">
                        <p className="text-xs text-red-400">
                          Query Error: {dbCheck.database_check.query_error}
                        </p>
                        <p className="text-xs text-white/40 mt-1">
                          Code: {dbCheck.database_check.query_code}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* All Invites Display */}
          {allInvites && (
            <div className="space-y-3 pt-4 border-t border-amber-500/20">
              <h3 className="text-sm font-semibold text-white">
                All Invites in Database ({allInvites.count || 0})
              </h3>
              {allInvites.error ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                  <p className="text-sm text-red-400">{allInvites.error}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allInvites.invites?.map((inv: any) => (
                    <div
                      key={inv.id}
                      className="rounded-lg border border-white/[0.08] bg-black/40 p-3"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-white">{inv.creator_name}</span>
                        <span
                          className={`text-xs ${inv.status === "active" ? "text-cyan-400" : "text-white/40"}`}
                        >
                          {inv.status}
                        </span>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-white/60">Has Raw Token:</span>
                          <span className={inv.has_raw_token ? "text-green-400" : "text-red-400"}>
                            {inv.has_raw_token ? "Yes" : "No"}
                          </span>
                        </div>
                        {inv.has_raw_token && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-white/60">Token Length:</span>
                              <span className="text-white">{inv.raw_token_length}</span>
                            </div>
                            <div className="mt-2">
                              <p className="text-white/60 mb-1">Raw Token:</p>
                              <div className="rounded bg-black/60 p-2 font-mono text-[10px] text-cyan-400 break-all">
                                {inv.raw_token}
                              </div>
                              <button
                                onClick={() => {
                                  setToken(inv.raw_token);
                                  handleDebug();
                                }}
                                className="mt-2 w-full rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/20"
                              >
                                Test this token
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Migration SQL Display */}
          {migrations && (
            <div className="pt-4 border-t border-amber-500/20">
              <h3 className="text-sm font-semibold text-white mb-2">Migrations to Run</h3>
              <p className="text-xs text-amber-300 mb-3">
                Copy each SQL block and run it in your Supabase SQL Editor (Dashboard → SQL Editor)
              </p>
              {migrations.error ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                  <p className="text-sm text-red-400">{migrations.error}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {migrations.migrations?.map((mig: any, idx: number) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-white/[0.08] bg-black/40 p-3"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-white">{mig.file}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(mig.sql);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-medium text-cyan-400 transition-all hover:bg-cyan-500/20"
                        >
                          {copied ? "Copied!" : "Copy SQL"}
                        </button>
                      </div>
                      {mig.error ? (
                        <p className="text-xs text-red-400">{mig.error}</p>
                      ) : (
                        <pre className="max-h-32 overflow-y-auto rounded bg-black/60 p-2 text-[10px] text-white/70">
                          {mig.sql.substring(0, 200)}...
                        </pre>
                      )}
                    </div>
                  ))}
                  <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3">
                    <p className="text-xs font-semibold text-green-400 mb-1">Steps:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-green-300">
                      <li>Go to Supabase Dashboard → SQL Editor</li>
                      <li>Copy and run each SQL block above (in order)</li>
                      <li>Come back here and click &quot;Check Database Health&quot; again</li>
                      <li>Table should show &quot;Yes ✓&quot; and you can create invites!</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

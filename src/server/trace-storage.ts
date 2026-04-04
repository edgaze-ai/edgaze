import { randomUUID } from "node:crypto";

import { createSupabaseAdminClient } from "@lib/supabase/admin";

import type { TraceEntryRow } from "src/server/trace";

export const WORKFLOW_TRACES_BUCKET = "workflow_traces";

/** Per-object UTF-8 payload target (under bucket limit). */
export const TRACE_PART_MAX_BYTES = 6 * 1024 * 1024;

/** Lazy full-bundle cache max size (compact JSON). */
export const TRACE_BUNDLE_CACHE_MAX_BYTES = 90 * 1024 * 1024;

const PART_SCHEMA_VERSION = 1;
const UPLOAD_MAX_ATTEMPTS = 4;
const UPLOAD_BASE_DELAY_MS = 200;

type TracePartFile = {
  v: number;
  trace_session_id: string;
  entries: TraceEntryRow[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStorageError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("timeout") ||
    m.includes("network") ||
    m.includes("econnreset") ||
    m.includes("etimedout") ||
    m.includes("503") ||
    m.includes("502") ||
    m.includes("504") ||
    m.includes("429")
  );
}

export async function ensureTraceSessionStorageRoot(traceSessionId: string): Promise<string> {
  const supabase = createSupabaseAdminClient() as any;
  const { data: existing, error: selErr } = await supabase
    .from("trace_session_storage_root")
    .select("storage_root_id")
    .eq("trace_session_id", traceSessionId)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing?.storage_root_id) return String(existing.storage_root_id);

  const storageRootId = randomUUID();
  const { error: insErr } = await supabase.from("trace_session_storage_root").insert({
    trace_session_id: traceSessionId,
    storage_root_id: storageRootId,
  });
  if (insErr) {
    const { data: again, error: againErr } = await supabase
      .from("trace_session_storage_root")
      .select("storage_root_id")
      .eq("trace_session_id", traceSessionId)
      .maybeSingle();
    if (againErr) throw againErr;
    if (again?.storage_root_id) return String(again.storage_root_id);
    throw insErr;
  }
  return storageRootId;
}

export async function fetchStorageRootsForSessions(
  traceSessionIds: string[],
): Promise<Map<string, string>> {
  if (traceSessionIds.length === 0) return new Map();
  const supabase = createSupabaseAdminClient() as any;
  const { data, error } = await supabase
    .from("trace_session_storage_root")
    .select("trace_session_id, storage_root_id")
    .in("trace_session_id", traceSessionIds);
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.trace_session_id && row.storage_root_id) {
      map.set(String(row.trace_session_id), String(row.storage_root_id));
    }
  }
  return map;
}

function estimatePartBytes(traceSessionId: string, batch: TraceEntryRow[]): number {
  const payload: TracePartFile = {
    v: PART_SCHEMA_VERSION,
    trace_session_id: traceSessionId,
    entries: batch,
  };
  return Buffer.byteLength(JSON.stringify(payload), "utf8");
}

export function splitEntriesIntoParts(
  traceSessionId: string,
  entries: TraceEntryRow[],
  maxBytes: number,
): TraceEntryRow[][] {
  if (entries.length === 0) return [];
  const parts: TraceEntryRow[][] = [];
  let current: TraceEntryRow[] = [];
  for (const entry of entries) {
    const candidate = [...current, entry];
    if (current.length > 0 && estimatePartBytes(traceSessionId, candidate) > maxBytes) {
      parts.push(current);
      current = [entry];
      if (estimatePartBytes(traceSessionId, current) > maxBytes) {
        parts.push([entry]);
        current = [];
      }
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) parts.push(current);
  return parts;
}

async function uploadJsonObject(
  objectPath: string,
  body: Uint8Array | ArrayBuffer | Buffer,
  options: { upsert: boolean },
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  let lastMessage = "";
  for (let attempt = 1; attempt <= UPLOAD_MAX_ATTEMPTS; attempt++) {
    const { error } = await supabase.storage.from(WORKFLOW_TRACES_BUCKET).upload(objectPath, body, {
      contentType: "application/json",
      upsert: options.upsert,
    });
    if (!error) return;
    lastMessage = error.message;
    const retry = isRetryableStorageError(error.message) && attempt < UPLOAD_MAX_ATTEMPTS;
    if (retry) {
      await sleep(UPLOAD_BASE_DELAY_MS * 2 ** (attempt - 1));
      continue;
    }
    throw new Error(`[trace-storage] upload failed: ${objectPath}: ${error.message}`);
  }
  throw new Error(`[trace-storage] upload failed: ${objectPath}: ${lastMessage}`);
}

export async function uploadTraceEntryParts(params: {
  storageRootId: string;
  traceSessionId: string;
  entries: TraceEntryRow[];
}): Promise<void> {
  if (params.entries.length === 0) return;
  const batches = splitEntriesIntoParts(
    params.traceSessionId,
    params.entries,
    TRACE_PART_MAX_BYTES,
  );
  const prefix = `${params.storageRootId}/parts`;
  for (const batch of batches) {
    const payload: TracePartFile = {
      v: PART_SCHEMA_VERSION,
      trace_session_id: params.traceSessionId,
      entries: batch,
    };
    const json = JSON.stringify(payload);
    const body = Buffer.from(json, "utf8");
    const name = `${Date.now()}-${randomUUID().replace(/-/g, "").slice(0, 12)}.json`;
    await uploadJsonObject(`${prefix}/${name}`, body, { upsert: false });
  }
}

async function listAllPartObjects(storageRootId: string): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  const folder = `${storageRootId}/parts`;
  const paths: string[] = [];
  let offset = 0;
  const limit = 500;
  while (true) {
    const { data, error } = await supabase.storage
      .from(WORKFLOW_TRACES_BUCKET)
      .list(folder, { limit, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    const batch = data ?? [];
    for (const item of batch) {
      if (item.name?.endsWith(".json")) {
        paths.push(`${folder}/${item.name}`);
      }
    }
    if (batch.length < limit) break;
    offset += limit;
  }
  return paths;
}

export async function loadTraceEntriesFromStorageForRoot(
  storageRootId: string,
): Promise<TraceEntryRow[]> {
  const paths = await listAllPartObjects(storageRootId);
  if (paths.length === 0) return [];
  const supabase = createSupabaseAdminClient();
  const all: TraceEntryRow[] = [];
  for (const path of paths) {
    const { data, error } = await supabase.storage.from(WORKFLOW_TRACES_BUCKET).download(path);
    if (error) {
      console.error(`[trace-storage] download part failed ${path}:`, error.message);
      continue;
    }
    const text = await data.text();
    const parsed = JSON.parse(text) as TracePartFile;
    if (parsed.v !== PART_SCHEMA_VERSION || !Array.isArray(parsed.entries)) {
      console.error(`[trace-storage] invalid part schema: ${path}`);
      continue;
    }
    all.push(...parsed.entries);
  }
  return all;
}

export async function loadTraceEntriesFromStorageForRun(params: {
  traceSessionIds: string[];
  rootBySessionId: Map<string, string>;
}): Promise<TraceEntryRow[]> {
  const merged: TraceEntryRow[] = [];
  for (const sessionId of params.traceSessionIds) {
    const root = params.rootBySessionId.get(sessionId);
    if (!root) continue;
    const rows = await loadTraceEntriesFromStorageForRoot(root);
    if (rows.length > 0) merged.push(...rows);
  }
  merged.sort((a, b) => {
    if (a.timestamp_epoch_ms !== b.timestamp_epoch_ms) {
      return a.timestamp_epoch_ms - b.timestamp_epoch_ms;
    }
    if (a.sequence !== b.sequence) return a.sequence - b.sequence;
    return a.trace_session_id.localeCompare(b.trace_session_id);
  });
  return merged;
}

export async function getWorkflowRunTraceBundleRef(workflowRunId: string): Promise<{
  bundle_storage_path: string | null;
  bundle_bytes: number | null;
} | null> {
  const supabase = createSupabaseAdminClient() as any;
  const { data, error } = await supabase
    .from("workflow_run_trace_bundle_refs")
    .select("bundle_storage_path, bundle_bytes")
    .eq("workflow_run_id", workflowRunId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    bundle_storage_path:
      typeof data.bundle_storage_path === "string" ? data.bundle_storage_path : null,
    bundle_bytes: typeof data.bundle_bytes === "number" ? data.bundle_bytes : null,
  };
}

export async function upsertWorkflowRunTraceBundleRef(params: {
  workflowRunId: string;
  bundleStoragePath: string;
  bundleBytes: number;
  schemaVersion?: number;
}): Promise<void> {
  const supabase = createSupabaseAdminClient() as any;
  const { error } = await supabase.from("workflow_run_trace_bundle_refs").upsert(
    {
      workflow_run_id: params.workflowRunId,
      bundle_storage_path: params.bundleStoragePath,
      bundle_bytes: params.bundleBytes,
      bundle_updated_at: new Date().toISOString(),
      schema_version: params.schemaVersion ?? 1,
    },
    { onConflict: "workflow_run_id" },
  );
  if (error) throw error;
}

export async function uploadWorkflowTraceBundleJson(params: {
  workflowRunId: string;
  jsonCompact: string;
}): Promise<{ path: string; bytes: number }> {
  const buf = Buffer.from(params.jsonCompact, "utf8");
  if (buf.length > TRACE_BUNDLE_CACHE_MAX_BYTES) {
    throw new Error("BUNDLE_TOO_LARGE");
  }
  const path = `${params.workflowRunId}/bundle.json`;
  await uploadJsonObject(path, buf, { upsert: true });
  return { path, bytes: buf.length };
}

export async function downloadWorkflowTraceBundleFromStorage(bundlePath: string): Promise<Buffer> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(WORKFLOW_TRACES_BUCKET).download(bundlePath);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

async function listObjectsInFolder(folder: string): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  const paths: string[] = [];
  let offset = 0;
  const limit = 500;
  while (true) {
    const { data, error } = await supabase.storage
      .from(WORKFLOW_TRACES_BUCKET)
      .list(folder, { limit, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    const batch = data ?? [];
    for (const item of batch) {
      if (!item.name) continue;
      paths.push(folder ? `${folder}/${item.name}` : item.name);
    }
    if (batch.length < limit) break;
    offset += limit;
  }
  return paths;
}

async function removeStoragePaths(paths: string[]): Promise<number> {
  if (paths.length === 0) return 0;
  const supabase = createSupabaseAdminClient();
  let deleted = 0;
  const chunk = 100;
  for (let i = 0; i < paths.length; i += chunk) {
    const slice = paths.slice(i, i + chunk);
    const { error } = await supabase.storage.from(WORKFLOW_TRACES_BUCKET).remove(slice);
    if (error) throw error;
    deleted += slice.length;
  }
  return deleted;
}

export async function deleteSessionTracePartsFromStorage(storageRootId: string): Promise<number> {
  const paths = await listObjectsInFolder(`${storageRootId}/parts`);
  const jsonOnly = paths.filter((p) => p.endsWith(".json"));
  return removeStoragePaths(jsonOnly);
}

export async function deleteWorkflowRunBundleCacheFromStorage(
  workflowRunId: string,
): Promise<number> {
  const paths = await listObjectsInFolder(workflowRunId);
  return removeStoragePaths(paths);
}

export async function pruneExpiredWorkflowTraceStorage(options: { dryRun?: boolean }): Promise<{
  expiredSessionCount: number;
  storageRootIds: string[];
  workflowRunIds: string[];
  partsObjectsWouldRemove: number;
  bundleObjectsWouldRemove: number;
  sqlPrune?: { deleted_entries: number; deleted_artifacts: number; deleted_sessions: number };
}> {
  const { storageRootPrefixes, workflowRunBundlePrefixes, sessionRows } =
    await collectExpiredTraceStoragePrefixes();
  let partsCount = 0;
  let bundleCount = 0;
  for (const root of storageRootPrefixes) {
    const paths = await listObjectsInFolder(`${root}/parts`);
    partsCount += paths.filter((p) => p.endsWith(".json")).length;
  }
  for (const runId of workflowRunBundlePrefixes) {
    const paths = await listObjectsInFolder(runId);
    bundleCount += paths.length;
  }

  if (!options.dryRun) {
    for (const root of storageRootPrefixes) {
      await deleteSessionTracePartsFromStorage(root);
    }
    for (const runId of workflowRunBundlePrefixes) {
      await deleteWorkflowRunBundleCacheFromStorage(runId);
    }
    const supabase = createSupabaseAdminClient() as any;
    const { data: pruneData, error: pruneErr } = await supabase.rpc("prune_expired_trace_data");
    if (pruneErr) throw pruneErr;
    const row = Array.isArray(pruneData) ? pruneData[0] : pruneData;
    return {
      expiredSessionCount: sessionRows.length,
      storageRootIds: storageRootPrefixes,
      workflowRunIds: workflowRunBundlePrefixes,
      partsObjectsWouldRemove: partsCount,
      bundleObjectsWouldRemove: bundleCount,
      sqlPrune: row
        ? {
            deleted_entries: Number(row.deleted_entries ?? 0),
            deleted_artifacts: Number(row.deleted_artifacts ?? 0),
            deleted_sessions: Number(row.deleted_sessions ?? 0),
          }
        : undefined,
    };
  }

  return {
    expiredSessionCount: sessionRows.length,
    storageRootIds: storageRootPrefixes,
    workflowRunIds: workflowRunBundlePrefixes,
    partsObjectsWouldRemove: partsCount,
    bundleObjectsWouldRemove: bundleCount,
  };
}

export async function collectExpiredTraceStoragePrefixes(): Promise<{
  storageRootPrefixes: string[];
  workflowRunBundlePrefixes: string[];
  sessionRows: Array<{ id: string; workflow_run_id: string | null }>;
}> {
  const supabase = createSupabaseAdminClient() as any;
  const { data: expiredSessions, error } = await supabase
    .from("trace_sessions")
    .select("id, workflow_run_id")
    .lt("retention_expires_at", new Date().toISOString());
  if (error) throw error;
  const sessions = (expiredSessions ?? []) as Array<{ id: string; workflow_run_id: string | null }>;
  const sessionIds = sessions.map((s) => s.id).filter(Boolean);
  const roots = await fetchStorageRootsForSessions(sessionIds);
  const storageRootPrefixes = [...new Set([...roots.values()].map((id) => `${id}`))];
  const candidateRunIds = [
    ...new Set(
      sessions
        .map((s) => s.workflow_run_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  let workflowRunBundlePrefixes: string[] = [];
  if (candidateRunIds.length > 0) {
    const { data: stillRetained, error: retErr } = await supabase
      .from("trace_sessions")
      .select("workflow_run_id")
      .in("workflow_run_id", candidateRunIds)
      .gte("retention_expires_at", new Date().toISOString());
    if (retErr) throw retErr;
    const runsWithRetainedSessions = new Set(
      (stillRetained ?? []).map((r: { workflow_run_id: string }) => String(r.workflow_run_id)),
    );
    workflowRunBundlePrefixes = candidateRunIds.filter((id) => !runsWithRetainedSessions.has(id));
  }
  return {
    storageRootPrefixes,
    workflowRunBundlePrefixes,
    sessionRows: sessions,
  };
}

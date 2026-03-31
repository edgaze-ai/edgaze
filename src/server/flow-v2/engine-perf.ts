import { performance } from "node:perf_hooks";

/**
 * High-resolution timing for workflow engine diagnosis.
 * Enable with WORKFLOW_ENGINE_PERF_LOG=1 (server env).
 */
export function isWorkflowEnginePerfEnabled(): boolean {
  const v = process.env.WORKFLOW_ENGINE_PERF_LOG?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

type PhaseTotals = Map<string, { sumMs: number; count: number; maxMs: number }>;

const runTotals = new Map<string, PhaseTotals>();

function bump(runId: string, phase: string, ms: number): void {
  let phases = runTotals.get(runId);
  if (!phases) {
    phases = new Map();
    runTotals.set(runId, phases);
  }
  const cur = phases.get(phase) ?? { sumMs: 0, count: 0, maxMs: 0 };
  cur.sumMs += ms;
  cur.count += 1;
  cur.maxMs = Math.max(cur.maxMs, ms);
  phases.set(phase, cur);
}

export function resetWorkflowEnginePerfTotals(runId: string): void {
  runTotals.delete(runId);
}

export function logWorkflowEnginePerfTotals(runId: string, label: string): void {
  if (!isWorkflowEnginePerfEnabled()) return;
  const phases = runTotals.get(runId);
  if (!phases || phases.size === 0) return;
  const rows: Record<string, { sumMs: number; count: number; maxMs: number; avgMs: number }> = {};
  let grand = 0;
  for (const [phase, t] of phases) {
    grand += t.sumMs;
    rows[phase] = {
      sumMs: Number(t.sumMs.toFixed(2)),
      count: t.count,
      maxMs: Number(t.maxMs.toFixed(2)),
      avgMs: Number((t.sumMs / Math.max(1, t.count)).toFixed(2)),
    };
  }
  console.warn(
    JSON.stringify({
      tag: "workflow_engine_perf_totals",
      runId,
      label,
      grandMs: Number(grand.toFixed(2)),
      phases: rows,
    }),
  );
}

export async function perfAsync<T>(
  runId: string,
  phase: string,
  fn: () => Promise<T>,
  meta?: Record<string, string | number | boolean | null | undefined>,
): Promise<T> {
  if (!isWorkflowEnginePerfEnabled()) {
    return fn();
  }
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    const ms = performance.now() - t0;
    bump(runId, phase, ms);
    console.warn(
      JSON.stringify({
        tag: "workflow_engine_perf",
        runId,
        phase,
        ms: Number(ms.toFixed(3)),
        ...meta,
      }),
    );
  }
}

export function perfSync<T>(
  runId: string,
  phase: string,
  fn: () => T,
  meta?: Record<string, string | number | boolean | null | undefined>,
): T {
  if (!isWorkflowEnginePerfEnabled()) {
    return fn();
  }
  const t0 = performance.now();
  try {
    return fn();
  } finally {
    const ms = performance.now() - t0;
    bump(runId, phase, ms);
    console.warn(
      JSON.stringify({
        tag: "workflow_engine_perf",
        runId,
        phase,
        ms: Number(ms.toFixed(3)),
        ...meta,
      }),
    );
  }
}

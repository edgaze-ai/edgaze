#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { basename } from "node:path";

const inputPath = process.argv[2];

if (!inputPath) {
  console.error("Usage: node scripts/analyze-workflow-engine-perf.mjs <perf-log-file>");
  process.exit(1);
}

const raw = readFileSync(inputPath, "utf8");
const lines = raw.split(/\r?\n/).filter(Boolean);

const spanRows = [];
const totalRows = [];

for (const line of lines) {
  try {
    const parsed = JSON.parse(line);
    if (parsed?.tag === "workflow_engine_perf") {
      spanRows.push(parsed);
    } else if (parsed?.tag === "workflow_engine_perf_totals") {
      totalRows.push(parsed);
    }
  } catch {
    // Ignore non-JSON log lines.
  }
}

if (spanRows.length === 0 && totalRows.length === 0) {
  console.error(`No workflow engine perf rows found in ${basename(inputPath)}.`);
  process.exit(1);
}

const ENGINE_PREFIXES = [
  "batch.",
  "runner.",
  "reevaluate.",
  "serialization.",
  "node.load",
  "node.materialize",
  "node.persist",
  "node.streamEmit",
  "node.executor.",
];

function isExternalPhase(phase) {
  return phase === "node.handler.external";
}

function isEnginePhase(phase) {
  return ENGINE_PREFIXES.some((prefix) => phase.startsWith(prefix));
}

function classifyPhase(phase) {
  if (phase.includes("appendRunEvent") || phase.includes("appendRunEvents")) return "architecture";
  if (phase === "batch.getRunState" || phase === "batch.claimNextRunnableNode") return "architecture";
  if (phase.startsWith("serialization.inlinePayload")) return "implementation";
  if (phase.startsWith("node.loadRunInput") || phase.startsWith("node.loadUpstreamOutputs")) {
    return "implementation";
  }
  if (phase.startsWith("reevaluate.")) return "architecture";
  if (phase.startsWith("node.executor.")) return "implementation";
  if (phase.startsWith("runner.idleBackoff_wait")) return "architecture";
  return "implementation";
}

const phaseAgg = new Map();
const runAgg = new Map();
const nodeAgg = new Map();

for (const row of spanRows) {
  const phase = String(row.phase ?? "unknown");
  const ms = Number(row.ms ?? 0);
  const runId = String(row.runId ?? "unknown");
  const nodeId = typeof row.nodeId === "string" ? row.nodeId : null;

  const cur = phaseAgg.get(phase) ?? { sumMs: 0, count: 0, maxMs: 0 };
  cur.sumMs += ms;
  cur.count += 1;
  cur.maxMs = Math.max(cur.maxMs, ms);
  phaseAgg.set(phase, cur);

  const runCur = runAgg.get(runId) ?? {
    engineMs: 0,
    externalMs: 0,
    totalMs: 0,
  };
  runCur.totalMs += ms;
  if (isExternalPhase(phase)) runCur.externalMs += ms;
  else if (isEnginePhase(phase)) runCur.engineMs += ms;
  runAgg.set(runId, runCur);

  if (nodeId) {
    const key = `${runId}:${nodeId}`;
    const nodeCur = nodeAgg.get(key) ?? {
      runId,
      nodeId,
      engineMs: 0,
      externalMs: 0,
      totalMs: 0,
    };
    nodeCur.totalMs += ms;
    if (isExternalPhase(phase)) nodeCur.externalMs += ms;
    else if (isEnginePhase(phase)) nodeCur.engineMs += ms;
    nodeAgg.set(key, nodeCur);
  }
}

const totalEngineMs = [...phaseAgg.entries()]
  .filter(([phase]) => isEnginePhase(phase))
  .reduce((sum, [, value]) => sum + value.sumMs, 0);

const topEnginePhases = [...phaseAgg.entries()]
  .filter(([phase]) => isEnginePhase(phase))
  .map(([phase, value]) => ({
    phase,
    sumMs: value.sumMs,
    count: value.count,
    maxMs: value.maxMs,
    avgMs: value.sumMs / Math.max(value.count, 1),
    pctEngine: totalEngineMs > 0 ? (value.sumMs / totalEngineMs) * 100 : 0,
    classification: classifyPhase(phase),
  }))
  .sort((left, right) => right.sumMs - left.sumMs)
  .slice(0, 10);

const topNodes = [...nodeAgg.values()]
  .sort((left, right) => right.engineMs - left.engineMs)
  .slice(0, 10);

function formatMs(value) {
  return `${value.toFixed(2)} ms`;
}

function formatPct(value) {
  return `${value.toFixed(1)}%`;
}

const output = [];
output.push("# Workflow Engine Perf Report");
output.push("");
output.push(`Source: \`${inputPath}\``);
output.push("");
output.push("## Run Summary");
output.push("");
output.push("| Run | Engine (non-model) | External/model | Instrumented total |");
output.push("|-----|--------------------:|---------------:|-------------------:|");
for (const [runId, stats] of [...runAgg.entries()].sort((a, b) => b[1].engineMs - a[1].engineMs)) {
  output.push(
    `| \`${runId}\` | ${formatMs(stats.engineMs)} | ${formatMs(stats.externalMs)} | ${formatMs(stats.totalMs)} |`,
  );
}

output.push("");
output.push("## Top 10 Engine Phases");
output.push("");
output.push("| Phase | Calls | Avg | Worst | Total | % non-model | Class |");
output.push("|-------|------:|----:|------:|------:|------------:|-------|");
for (const row of topEnginePhases) {
  output.push(
    `| \`${row.phase}\` | ${row.count} | ${formatMs(row.avgMs)} | ${formatMs(row.maxMs)} | ${formatMs(row.sumMs)} | ${formatPct(row.pctEngine)} | ${row.classification} |`,
  );
}

if (topNodes.length > 0) {
  output.push("");
  output.push("## Top 10 Node Overheads");
  output.push("");
  output.push("| Run | Node | Engine (non-model) | External/model | Instrumented total |");
  output.push("|-----|------|--------------------:|---------------:|-------------------:|");
  for (const row of topNodes) {
    output.push(
      `| \`${row.runId}\` | \`${row.nodeId}\` | ${formatMs(row.engineMs)} | ${formatMs(row.externalMs)} | ${formatMs(row.totalMs)} |`,
    );
  }
}

if (totalRows.length > 0) {
  output.push("");
  output.push("## Raw Totals Rows");
  output.push("");
  output.push("```json");
  output.push(JSON.stringify(totalRows, null, 2));
  output.push("```");
}

console.log(output.join("\n"));

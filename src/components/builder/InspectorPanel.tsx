// src/components/builder/InspectorPanel.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Eye, TrendingUp, Users, Sliders, Code2 } from "lucide-react";
import { getNodeSpec } from "src/nodes/registry";

/* -------------------- Types -------------------- */
type Selection = {
  nodeId: string | null;
  nodeIds?: string[];
  specId?: string;
  config?: any;
};

type Analytics = {
  totalRuns: number;
  successRate: number;
  avgResponseMs: number;
};

type Community = {
  todayUsers: number;
  weeklyRemixes: number;
  featured?: boolean;
};

/* -------------------- Utility -------------------- */
async function safeJSON<T>(res: Response): Promise<T | null> {
  try {
    const txt = await res.text();
    if (!txt) return null;
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

/* -------------------- External Fetch Hooks -------------------- */
function useAnalytics(workflowId?: string) {
  const [data, setData] = useState<Analytics | null>(null);
  const [state, setState] = useState<
    "idle" | "loading" | "ready" | "missing" | "error"
  >("idle");

  useEffect(() => {
    if (!workflowId) {
      queueMicrotask(() => {
        setState("missing");
        setData(null);
      });
      return;
    }

    let aborted = false;
    queueMicrotask(() => setState("loading"));

    fetch(`/api/analytics/workflow?workflowId=${workflowId}`)
      .then(async (res) => {
        if (aborted) return;

        if (res.status === 404) {
          setState("missing");
          setData(null);
          return;
        }

        if (!res.ok) {
          setState("error");
          setData(null);
          return;
        }

        const json = await safeJSON<Analytics>(res);
        if (!json) {
          setState("missing");
          setData(null);
          return;
        }

        setData(json);
        setState("ready");
      })
      .catch(() => {
        if (!aborted) {
          setState("error");
          setData(null);
        }
      });

    return () => {
      aborted = true;
    };
  }, [workflowId]);

  return { data, state };
}

function useCommunity(workflowId?: string) {
  const [data, setData] = useState<Community | null>(null);
  const [state, setState] = useState<
    "idle" | "loading" | "ready" | "missing" | "error"
  >("idle");

  useEffect(() => {
    if (!workflowId) {
      queueMicrotask(() => {
        setState("missing");
        setData(null);
      });
      return;
    }

    let aborted = false;
    queueMicrotask(() => setState("loading"));

    fetch(`/api/community/workflow?workflowId=${workflowId}`)
      .then(async (res) => {
        if (aborted) return;

        if (res.status === 404) {
          setState("missing");
          setData(null);
          return;
        }

        if (!res.ok) {
          setState("error");
          setData(null);
          return;
        }

        const json = await safeJSON<Community>(res);
        if (!json) {
          setState("missing");
          setData(null);
          return;
        }

        setData(json);
        setState("ready");
      })
      .catch(() => {
        if (!aborted) {
          setState("error");
          setData(null);
        }
      });

    return () => {
      aborted = true;
    };
  }, [workflowId]);

  return { data, state };
}

/* -------------------- UI Helpers (Vercel premium style) -------------------- */
function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="mb-2 flex items-center gap-2">
        {icon && <span className="text-white/40">{icon}</span>}
        <div className="text-[11px] font-medium uppercase tracking-wider text-white/50">
          {title}
        </div>
      </div>
      {children}
    </div>
  );
}

const Input = (props: any) => (
  <input
    {...props}
    className={`w-full min-w-0 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[12px]
    text-white/95 placeholder:text-white/30
    focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10
    transition-colors ${props.className ?? ""}`}
  />
);

const TextArea = (props: any) => (
  <textarea
    {...props}
    className={`w-full min-w-0 resize-y rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[12px]
    text-white/95 placeholder:text-white/30
    focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10
    transition-colors ${props.className ?? ""}`}
  />
);

function ReadOnlyMeta({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px]">
      {items.map(({ label, value }) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className="text-white/35">{label}</span>
          <span className="text-white/55 font-mono truncate max-w-[120px]">{value}</span>
        </span>
      ))}
    </div>
  );
}

/* ============================================================
   PANEL IMPLEMENTATIONS
============================================================ */

/* -------- General Panel -------- */
function GeneralPanel({
  selection,
  spec,
  onUpdate,
}: {
  selection: Selection;
  spec: any;
  onUpdate: (p: any) => void;
}) {
  const cfg = selection.config ?? {};
  const inspectorFields = spec?.inspector ?? [];
  const advancedKeys = new Set(["timeout", "retries", "allowOnly", "denyHosts", "maxTokens", "maxIterations"]);

  // Auto-fix OpenAI Image config so invalid model+size/quality are never sent to the API
  useEffect(() => {
    if (spec?.id !== "openai-image" || !selection.nodeId) return;
    const model = cfg.model || "dall-e-2";
    const size = cfg.size || "1024x1024";
    const quality = cfg.quality || "standard";
    const dallE2Sizes = ["256x256", "512x512", "1024x1024"];
    const dallE3Sizes = ["1024x1024", "1792x1024", "1024x1792"];
    const updates: Record<string, string> = {};
    if (model === "dall-e-2") {
      if (quality === "hd") updates.quality = "standard";
      if (!dallE2Sizes.includes(size)) updates.size = "1024x1024";
    } else if (model === "dall-e-3" && !dallE3Sizes.includes(size)) {
      updates.size = "1024x1024";
    }
    if (Object.keys(updates).length > 0) onUpdate(updates);
  }, [spec?.id, selection.nodeId, cfg.model, cfg.size, cfg.quality, onUpdate]);

  const fieldLabel = (label: string, helpText?: string) => (
    <label className="block text-[10px] font-medium uppercase tracking-wider text-white/45 mb-1" title={helpText}>
      {label}
    </label>
  );

  const renderField = (field: any) => {
    const value = cfg[field.key] ?? (spec.defaultConfig?.[field.key] ?? "");

    switch (field.type) {
      case "text":
        return (
          <div key={field.key}>
            {fieldLabel(field.label, field.helpText)}
            <Input
              placeholder={field.placeholder}
              defaultValue={value}
              onBlur={(e: React.FocusEvent<HTMLInputElement>) =>
                onUpdate({ [field.key]: e.currentTarget.value })
              }
            />
          </div>
        );

      case "textarea":
        return (
          <div key={field.key}>
            {fieldLabel(field.label, field.helpText)}
            <TextArea
              rows={field.rows ?? 2}
              placeholder={field.placeholder}
              defaultValue={value}
              onBlur={(e: React.FocusEvent<HTMLTextAreaElement>) =>
                onUpdate({ [field.key]: e.currentTarget.value })
              }
            />
          </div>
        );

      case "number":
        return (
          <div key={field.key}>
            {fieldLabel(field.label, field.helpText)}
            <Input
              type="number"
              min={field.min}
              max={field.max}
              step={field.step ?? 1}
              defaultValue={value}
              onBlur={(e: React.FocusEvent<HTMLInputElement>) =>
                onUpdate({ [field.key]: Number(e.currentTarget.value) })
              }
            />
          </div>
        );

      case "slider":
        return (
          <div key={field.key}>
            <label className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/45" title={field.helpText}>{field.label}</span>
              <span className="text-[10px] text-white/60 font-mono">{value}</span>
            </label>
            <input
              type="range"
              min={field.min}
              max={field.max}
              step={field.step ?? (field.max - field.min) / 100}
              defaultValue={value}
              onChange={(e) => onUpdate({ [field.key]: Number(e.target.value) })}
              className="w-full h-1.5 bg-white/[0.06] rounded-full appearance-none cursor-pointer accent-white/40"
            />
          </div>
        );

      case "switch":
        return (
          <div key={field.key} className="flex items-center justify-between py-0.5">
            <label className="text-[10px] font-medium uppercase tracking-wider text-white/45" title={field.helpText}>
              {field.label}
            </label>
            <button
              type="button"
              onClick={() => onUpdate({ [field.key]: !value })}
              className={`relative w-9 h-5 rounded-full transition-colors ${
                value ? "bg-white/25" : "bg-white/[0.08]"
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                  value ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        );

      case "select": {
        const isOpenAIImage = spec?.id === "openai-image";
        const imageModel = cfg.model || "dall-e-2";
        const qualityDisabled = isOpenAIImage && field.key === "quality" && imageModel === "dall-e-2";
        const sizeOptionsDallE2 = [
          { label: "1024x1024", value: "1024x1024" },
          { label: "512x512", value: "512x512" },
          { label: "256x256", value: "256x256" },
        ];
        const sizeOptionsDallE3 = [
          { label: "1024x1024", value: "1024x1024" },
          { label: "1792x1024", value: "1792x1024" },
          { label: "1024x1792", value: "1024x1792" },
        ];
        const selectOptions =
          isOpenAIImage && field.key === "size"
            ? imageModel === "dall-e-3"
              ? sizeOptionsDallE3
              : sizeOptionsDallE2
            : field.options ?? [];
        let effectiveValue: string = qualityDisabled ? "standard" : value;
        if (isOpenAIImage && field.key === "size" && !selectOptions.some((o: any) => o.value === value)) {
          effectiveValue = selectOptions[0]?.value ?? "1024x1024";
        }
        return (
          <div key={field.key}>
            {fieldLabel(field.label, qualityDisabled ? "Only for DALL-E 3" : field.helpText)}
            <select
              value={effectiveValue}
              disabled={qualityDisabled}
              onChange={(e) => onUpdate({ [field.key]: e.target.value })}
              className="w-full min-w-0 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-white/95
                focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {selectOptions.map((opt: any) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {qualityDisabled && (
              <div className="mt-1 text-[9px] text-amber-400/80">Set Model to DALL-E 3 for HD.</div>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  // Special condition builder for condition nodes
  const isCondition = spec?.id === "condition";
  const conditionOperator = cfg.operator || "truthy";
  const conditionCompareValue = cfg.compareValue || "";

  // Check if node requires API keys
  const requiresApiKey = spec?.requiresUserKeys === true;

  return (
    <div className="space-y-3 pt-2 w-full min-w-0">
      {/* Basic details: small, read-only, no input boxes */}
      <ReadOnlyMeta items={[
        { label: "Type", value: spec?.label ?? "Block" },
        { label: "ID", value: selection.specId ?? "—" },
      ]} />

      {/* Editable fields - premium inputs only */}
      <div className="space-y-2.5">
        <div>
          <label className="block text-[10px] font-medium uppercase tracking-wider text-white/45 mb-1">Display Name</label>
          <Input
            defaultValue={cfg.name ?? spec.label}
            onBlur={(e: React.FocusEvent<HTMLInputElement>) =>
              onUpdate({ name: e.currentTarget.value })
            }
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium uppercase tracking-wider text-white/45 mb-1">Description</label>
          <TextArea
            rows={2}
            defaultValue={cfg.description ?? spec.summary}
            onBlur={(e: React.FocusEvent<HTMLTextAreaElement>) =>
              onUpdate({ description: e.currentTarget.value })
            }
          />
        </div>
        {requiresApiKey && (
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider text-white/45 mb-1" title="Stored locally, used for your runs">
              API Key
            </label>
            <Input
              type="password"
              placeholder="sk-..."
              defaultValue={cfg.apiKey || ""}
              onBlur={(e: React.FocusEvent<HTMLInputElement>) =>
                onUpdate({ apiKey: e.currentTarget.value })
              }
            />
          </div>
        )}
      </div>

      {isCondition && (
        <Card title="Condition" icon={<Code2 size={14} />}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-white/60">If value</span>
            <select
              value={conditionOperator}
              onChange={(e) => onUpdate({ operator: e.target.value, compareValue: conditionOperator === "equals" || conditionOperator === "notEquals" ? conditionCompareValue : "" })}
              className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px] text-white/90 focus:outline-none focus:ring-1 focus:ring-white/10"
            >
              <option value="truthy">is truthy</option>
              <option value="falsy">is falsy</option>
              <option value="equals">equals</option>
              <option value="notEquals">does not equal</option>
              <option value="gt">is greater than</option>
              <option value="lt">is less than</option>
            </select>
            {(conditionOperator === "equals" || conditionOperator === "notEquals" || conditionOperator === "gt" || conditionOperator === "lt") && (
              <Input
                placeholder="value"
                defaultValue={conditionCompareValue}
                onBlur={(e: React.FocusEvent<HTMLInputElement>) =>
                  onUpdate({ compareValue: e.currentTarget.value })
                }
                className="flex-1 min-w-[80px] max-w-[120px]"
              />
            )}
          </div>
        </Card>
      )}

      {inspectorFields.length > 0 && (
        <Card title="Configuration" icon={<Sliders size={14} />}>
          <div className="space-y-2.5">
            {inspectorFields.filter((f: any) => !advancedKeys.has(f.key)).map(renderField)}
          </div>
        </Card>
      )}

      {(cfg.timeout !== undefined ||
        cfg.retries !== undefined ||
        inspectorFields.some((f: any) => advancedKeys.has(f.key)) ||
        !inspectorFields.find((f: any) => f.key === "timeout")) && (
        <Card title="Advanced" icon={<Sliders size={14} />}>
          <details className="group">
            <summary className="cursor-pointer select-none text-[10px] font-medium text-white/50 hover:text-white/70 transition-colors">
              Show advanced
            </summary>
            <div className="mt-2.5 space-y-2.5">
              {inspectorFields.filter((f: any) => advancedKeys.has(f.key)).map(renderField)}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  {fieldLabel("Timeout (ms)")}
                  <Input
                    type="number"
                    defaultValue={cfg.timeout ?? 8000}
                    onBlur={(e: React.FocusEvent<HTMLInputElement>) =>
                      onUpdate({ timeout: Number(e.currentTarget.value) })
                    }
                  />
                </div>
                <div>
                  {fieldLabel("Retries")}
                  <Input
                    type="number"
                    defaultValue={cfg.retries ?? 0}
                    onBlur={(e: React.FocusEvent<HTMLInputElement>) =>
                      onUpdate({ retries: Number(e.currentTarget.value) })
                    }
                  />
                </div>
              </div>
            </div>
          </details>
        </Card>
      )}
    </div>
  );
}

/* -------- Inputs Panel -------- */
function InputsPanel({
  spec,
  selection,
  onUpdate,
}: {
  spec: any;
  selection: Selection;
  onUpdate: (p: any) => void;
}) {
  const cfg = selection.config ?? {};

  return (
    <div className="space-y-3 pt-2 w-full min-w-0">
      <Card title="Input Parameters">
        <div className="space-y-3">
          {spec.ports
            ?.filter((p: any) => p.kind === "input")
            ?.map((port: any) => (
              <div key={port.id} className="border-b border-white/[0.04] pb-3 last:border-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-[12px] font-medium text-white/90">{port.id}</span>
                  <span className="text-[9px] text-white/40 font-mono truncate">{port.type ?? "any"}</span>
                </div>
                {port.label && <div className="text-[10px] text-white/45 mb-1.5">{port.label}</div>}
                <Input
                  placeholder="Default value"
                  defaultValue={cfg?.inputs?.[port.id] ?? ""}
                  onBlur={(e: React.FocusEvent<HTMLInputElement>) =>
                    onUpdate({
                      inputs: { ...(cfg.inputs ?? {}), [port.id]: e.currentTarget.value },
                    })
                  }
                />
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}

/* -------- Code Panel -------- */
function CodePanel({ selection, spec }: { selection: Selection; spec: any }) {
  const cfg = selection.config ?? {};
  const code = cfg.code ?? spec?.code ?? "";

  return (
    <div className="space-y-3 pt-2 w-full min-w-0">
      <Card title="Config" icon={<Code2 size={14} />}>
        <pre className="text-[10px] text-white/60 bg-black/20 border border-white/[0.04] rounded-md p-2.5 overflow-auto max-h-[140px]">
          {JSON.stringify(cfg, null, 2)}
        </pre>
      </Card>
      <Card title="Implementation" icon={<Code2 size={14} />}>
        <pre className="text-[10px] text-white/60 bg-black/20 border border-white/[0.04] rounded-md p-2.5 overflow-auto max-h-[200px]">
          {String(code)}
        </pre>
      </Card>
    </div>
  );
}

/* ======================= MAIN COMPONENT ======================= */

type TabKey = "general" | "inputs" | "code";

function TabPill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
        active
          ? "bg-white/10 text-white"
          : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]",
      ].join(" ")}
      type="button"
    >
      {children}
    </button>
  );
}

const FIELD_HINT_LABELS: Record<string, string> = {
  prompt: "Prompt",
  url: "URL",
  text: "Text",
  model: "Model",
  size: "Size",
  quality: "Quality",
  question: "Question / Input Name",
  connection: "Invalid connection",
};

export default function InspectorPanel({
  selection,
  fieldHint,
  workflowId,
  onUpdate,
  getLatestGraph,
}: {
  selection?: Selection; // <-- keep optional + foolproof
  fieldHint?: string | null;
  workflowId?: string;
  onUpdate?: (nodeId: string, patch: any) => void;
  getLatestGraph?: () => { nodes: any[]; edges: any[] } | null;
}) {
  // FOOLPROOF: never crash if selection is undefined
  // Also try to get latest config from graph if available
  const safeSelection: Selection = useMemo(() => {
    const base = {
      nodeId: selection?.nodeId ?? null,
      nodeIds: selection?.nodeIds,
      specId: selection?.specId,
      config: selection?.config,
    };

    // If we have a nodeId and a way to get the latest graph, use the latest config
    if (base.nodeId && getLatestGraph) {
      const graph = getLatestGraph();
      const node = graph?.nodes?.find((n: any) => n.id === base.nodeId);
      if (node?.data?.config) {
        return {
          ...base,
          config: node.data.config,
        };
      }
    }

    return base;
  }, [selection?.nodeId, selection?.nodeIds, selection?.specId, selection?.config, getLatestGraph]);

  const selected = Boolean(safeSelection.nodeId);
  const multiSelected = Array.isArray(safeSelection.nodeIds) && safeSelection.nodeIds.length > 1;
  const [tab, setTab] = useState<TabKey>("general");

  // When selection changes, keep UX predictable
  useEffect(() => {
    queueMicrotask(() => setTab("general"));
  }, [safeSelection.nodeId, safeSelection.specId]);

  const spec = useMemo(() => {
    if (!safeSelection.specId) return null;
    try {
      return getNodeSpec(safeSelection.specId);
    } catch {
      return null;
    }
  }, [safeSelection.specId]);

  // Only fetch when a node is selected (avoids noise + wasted calls)
  const { data: analytics, state: aState } = useAnalytics(
    selected ? workflowId : undefined
  );
  const { data: community, state: cState } = useCommunity(
    selected ? workflowId : undefined
  );

  const patchNode = (patch: any) => {
    if (!onUpdate) return;
    if (!safeSelection.nodeId) return;
    onUpdate(safeSelection.nodeId, patch);
  };

  return (
    <div className="h-full w-full min-w-0 text-white flex flex-col">
      <div className="px-4 pt-4 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <Eye size={16} className="text-white/60" />
          <span className="text-[13px] font-semibold text-white/95 tracking-tight">Inspector</span>
        </div>
        {selected && fieldHint && (
          <div
            className="mt-2 rounded-lg px-3 py-2 text-[11px] font-medium"
            style={{
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "#f0a0a0",
            }}
          >
            Fix: <span className="font-semibold">{FIELD_HINT_LABELS[fieldHint] ?? fieldHint}</span>
            {fieldHint === "connection" && (
              <div className="mt-1 text-[10px] opacity-90">
                On the canvas: select and delete the invalid connection, or add the missing node.
              </div>
            )}
          </div>
        )}
        {selected && (
          <div className="mt-2 flex gap-2">
            <TabPill active={tab === "general"} onClick={() => setTab("general")}>
              General
            </TabPill>
            <TabPill active={tab === "inputs"} onClick={() => setTab("inputs")}>
              Inputs
            </TabPill>
            <TabPill active={tab === "code"} onClick={() => setTab("code")}>
              Code
            </TabPill>
          </div>
        )}
      </div>

      {/* Scroll area (this fixes the “scrolling not working inside inspector” bug) */}
      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden px-4 pb-4 overscroll-contain">
        {multiSelected && (
          <div className="pt-6 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-white/[0.04] border border-white/[0.06] grid place-items-center">
              <Eye size={20} className="text-white/40" />
            </div>
            <div className="mt-3 text-[12px] text-white/70">
              Select one at a time
            </div>
            <div className="mt-1 text-[10px] text-white/40">
              {safeSelection.nodeIds?.length ?? 0} blocks selected. Click a single block to inspect it.
            </div>
          </div>
        )}
        {!selected && !multiSelected && (
          <div className="pt-6 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-white/[0.04] border border-white/[0.06] grid place-items-center">
              <Eye size={20} className="text-white/40" />
            </div>
            <div className="mt-3 text-[12px] text-white/70">
              Select a block to edit
            </div>
            <div className="mt-1 text-[10px] text-white/40">
              Drag blocks from the left, then click to configure.
            </div>
            <div className="mt-4 space-y-2 text-left">
              <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-white/40" />
                  <span className="text-[11px] font-medium text-white/50">Analytics</span>
                </div>
                <div className="mt-1 text-[10px] text-white/40">Not available</div>
              </div>
              <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-white/40" />
                  <span className="text-[11px] font-medium text-white/50">Community</span>
                </div>
                <div className="mt-1 text-[10px] text-white/40">Not available</div>
              </div>
            </div>
          </div>
        )}

        {selected && (
          <>
            {/* Main tab content */}
            {spec ? (
              <>
                {tab === "general" && (
                  <GeneralPanel
                    selection={safeSelection}
                    spec={spec}
                    onUpdate={patchNode}
                  />
                )}
                {tab === "inputs" && (
                  <InputsPanel
                    selection={safeSelection}
                    spec={spec}
                    onUpdate={patchNode}
                  />
                )}
                {tab === "code" && <CodePanel selection={safeSelection} spec={spec} />}
              </>
            ) : (
              <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-white/50">
                Spec not found for this node.
              </div>
            )}

            <div className="mt-4 space-y-2">
              <Card title="Analytics" icon={<TrendingUp size={14} />}>
                {aState !== "ready" || !analytics ? (
                  <div className="text-[10px] text-white/40">Not available</div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-md bg-white/[0.03] border border-white/[0.04] px-2 py-1.5">
                      <div className="text-[9px] text-white/40">Runs</div>
                      <div className="text-[12px] font-semibold text-white/90">{analytics.totalRuns}</div>
                    </div>
                    <div className="rounded-md bg-white/[0.03] border border-white/[0.04] px-2 py-1.5">
                      <div className="text-[9px] text-white/40">Success</div>
                      <div className="text-[12px] font-semibold text-white/90">{analytics.successRate}%</div>
                    </div>
                    <div className="rounded-md bg-white/[0.03] border border-white/[0.04] px-2 py-1.5">
                      <div className="text-[9px] text-white/40">Avg</div>
                      <div className="text-[12px] font-semibold text-white/90">{analytics.avgResponseMs}ms</div>
                    </div>
                  </div>
                )}
              </Card>
              <Card title="Community" icon={<Users size={14} />}>
                {cState !== "ready" || !community ? (
                  <div className="text-[10px] text-white/40">Not available</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-white/[0.03] border border-white/[0.04] px-2 py-1.5">
                      <div className="text-[9px] text-white/40">Today</div>
                      <div className="text-[12px] font-semibold text-white/90">{community.todayUsers}</div>
                    </div>
                    <div className="rounded-md bg-white/[0.03] border border-white/[0.04] px-2 py-1.5">
                      <div className="text-[9px] text-white/40">Remixes</div>
                      <div className="text-[12px] font-semibold text-white/90">{community.weeklyRemixes}</div>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

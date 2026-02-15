"use client";

import { memo, useMemo } from "react";
import { Handle, Position, type NodeProps, useStore } from "reactflow";
import { getNodeSpec } from "src/nodes/registry";
import { emit } from "src/lib/bus";

/* ---------------- Selection ring (premium glow) ---------------- */

function SelectionRing() {
  return (
    <div
      className="pointer-events-none absolute -inset-[7px] rounded-[18px]"
      style={{
        background:
          "linear-gradient(120deg, rgba(56,189,248,0.95), rgba(244,114,182,0.95))",
        padding: 2.5,
        WebkitMask:
          "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        WebkitMaskComposite: "xor",
        maskComposite: "exclude",
        boxShadow:
          "0 0 26px rgba(56,189,248,0.33), 0 0 26px rgba(244,114,182,0.33)",
      }}
    />
  );
}

/* ---------------- Port side helper ---------------- */

function sideFor(id: string | undefined, portKind: "input" | "output" = "output"): Position {
  if (!id) return portKind === "input" ? Position.Left : Position.Right;
  const k = id.toLowerCase();
  if (k.includes("left")) return Position.Left;
  if (k.includes("right")) return Position.Right;
  if (k.includes("top")) return Position.Top;
  if (k.includes("bottom")) return Position.Bottom;
  // Default: inputs on left, outputs on right
  return portKind === "input" ? Position.Left : Position.Right;
}

/* ---------------- Utility: build preview text ---------------- */

function buildPreview(data: any, summary: string): string {
  if (!data) return summary;

  const candidate =
    data.preview ??
    data.lastOutput ??
    data.output ??
    data.sample ??
    data.config ??
    data.state ??
    summary;

  if (candidate == null) return summary;

  if (typeof candidate === "string") {
    return candidate.length > 260
      ? candidate.slice(0, 260).trimEnd() + "…"
      : candidate;
  }

  try {
    const json = JSON.stringify(candidate, null, 2);
    if (!json) return summary;
    return json.length > 260 ? json.slice(0, 260).trimEnd() + "…" : json;
  } catch {
    return summary;
  }
}

/* ---------------- Node frame ---------------- */

function NodeFrameImpl(props: NodeProps) {
  const { id, selected, data, isConnectable = true } = props as any;

  const spec = getNodeSpec(data?.specId);

  const title: string = spec?.label ?? data?.title ?? "Node";
  const version: string = spec?.version ?? data?.version ?? "1.0.0";
  const summary: string = spec?.summary ?? data?.summary ?? "";
  const status: string | undefined = data?.status;

  const ports = spec?.ports ?? [];
  const inputs = ports.filter((p) => p.kind === "input");
  const outputs = ports.filter((p) => p.kind === "output");

  const inlineToggles = (spec as any)?.inlineToggles ?? [];
  const canvasFields = (spec as any)?.canvasFields ?? [];

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- data is from React Flow node, stable in practice
  const previewText = useMemo(() => buildPreview(data, summary), [data, summary]);

  const { nodeInternals, edges } = useStore((s) => ({
    nodeInternals: s.nodeInternals,
    edges: s.edges,
  }));

  const connectedNames = useMemo(() => {
    const list = edges
      .filter((e) => e.source === id)
      .map((e) => nodeInternals.get(e.target))
      .map((n) => (n?.data?.title as string) || n?.id)
      .filter(Boolean) as string[];

    return list.slice(0, 4);
  }, [edges, id, nodeInternals]);

  const hasConnections = connectedNames.length > 0;

  const isOutput = (spec as any)?.id === "output";

  // Get connected input for output node
  const connectedInput = useMemo(() => {
    if (!isOutput) return null;
    const inputEdge = edges.find((e) => e.target === id);
    if (!inputEdge) return null;
    const sourceNode = nodeInternals.get(inputEdge.source);
    return sourceNode;
  }, [isOutput, edges, id, nodeInternals]);

  // Build human-readable output description
  const outputDescription = useMemo(() => {
    if (!isOutput) return null;
    if (!connectedInput) {
      return "No input connected. Connect a node to see what will be output.";
    }
    const sourceTitle = connectedInput.data?.title || connectedInput.id;
    const sourceSpec = getNodeSpec(connectedInput.data?.specId);
    const sourceLabel = sourceSpec?.label || sourceTitle;

    const format = data?.config?.format || "json";
    if (format === "json") {
      return `Will output the result from "${sourceLabel}" as JSON.`;
    } else if (format === "text") {
      return `Will output the result from "${sourceLabel}" as plain text.`;
    } else if (format === "html") {
      return `Will output the result from "${sourceLabel}" as HTML.`;
    }
    return `Will output the result from "${sourceLabel}".`;
  }, [isOutput, connectedInput, data?.config?.format]);

  const shouldShowPreview =
    selected && (data?.preview != null || data?.lastOutput != null || data?.output != null);

  const renderCanvasField = (field: any) => {
    const value = data?.config?.[field.key] ?? (spec as any)?.defaultConfig?.[field.key];

    if (field.type === "switch") {
      const on = Boolean(value);
      return (
        <button
          key={field.key}
          type="button"
          onClick={() => emit("builder:updateNodeConfig", { nodeId: id, patch: { [field.key]: !on } })}
                    className={[
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition",
                      on ? "border-white/20 bg-white/10 text-white" : "border-white/12 bg-black/30 text-white/70 hover:bg-white/5 hover:text-white/85",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "h-2.5 w-2.5 rounded-full",
                        on ? "bg-[#ff0071]" : "bg-white/20",
                      ].join(" ")}
                    />
                    {field.label}
                  </button>
      );
    }

    if (field.type === "select") {
      return (
        <label key={field.key} className="block">
          <div className="text-[12px] font-semibold text-white/80">{field.label}</div>
          <div className="mt-2 space-y-2">
            {(field.options ?? []).map((opt: any) => {
              const checked = String(value ?? "") === String(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => emit("builder:updateNodeConfig", { nodeId: id, patch: { [field.key]: opt.value } })}
                  className="flex items-center gap-3 text-left"
                >
                  <span
                    className={[
                      "h-4 w-4 rounded-full border",
                      checked ? "border-[#ff0071]" : "border-white/20",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "block h-full w-full rounded-full",
                        checked ? "bg-[#ff0071] scale-[0.55]" : "bg-transparent",
                      ].join(" ")}
                    />
                  </span>
                  <span className={checked ? "text-white" : "text-white/70"}>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </label>
      );
    }

    if (field.type === "slider") {
      const min = field.min ?? 0;
      const max = field.max ?? 100;
      const step = field.step ?? 1;
      const vNum = typeof value === "number" ? value : Number(value ?? min);
      return (
        <label key={field.key} className="block">
          <div className="flex items-center justify-between">
            <div className="text-[12px] font-semibold text-white/80">{field.label}</div>
            <div className="text-[12px] text-white/60 font-mono">{vNum}</div>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={Number.isFinite(vNum) ? vNum : min}
            onChange={(e) =>
              emit("builder:updateNodeConfig", { nodeId: id, patch: { [field.key]: Number(e.target.value) } })
            }
            className="mt-2 w-full accent-[#ff0071]"
          />
        </label>
      );
    }

    return null;
  };

  return (
    <div className="relative" data-nodeid={id}>
      {selected && <SelectionRing />}

      {/* Compact, n8n-like card - dark theme */}
      <div
        className={[
          "edge-card relative rounded-2xl overflow-hidden",
          isOutput ? "min-w-[560px] min-h-[340px]" : "min-w-[260px]",
        ].join(" ")}
      >
        <div className="edge-card-header">
          <span className="truncate text-white">{title}</span>
          <span className="text-[10px] opacity-70 font-mono text-white/60">v{version}</span>
        </div>

        <div className={isOutput ? "p-6" : "p-4"}>
          {/* Output node: Show human-readable description */}
          {isOutput && (
            <div className="mb-4">
              <div className="text-[13px] font-medium text-white/90 leading-relaxed">
                {outputDescription || "No input connected. Connect a node to see what will be output."}
              </div>
            </div>
          )}

          {/* Small description (only if useful, not for output) */}
          {!isOutput && summary && (
            <div className="text-[12px] text-white/70 leading-snug">{summary}</div>
          )}

          {/* Inline toggles */}
          {inlineToggles.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {inlineToggles.map((t: any) => {
                const on = Boolean(data?.config?.[t.key]);
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => emit("builder:updateNodeConfig", { nodeId: id, patch: { [t.key]: !on } })}
                    className={[
                      "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition",
                      on ? "border-white/20 bg-white/10 text-white" : "border-white/12 bg-black/30 text-white/70 hover:bg-white/5 hover:text-white/85",
                    ].join(" ")}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Canvas controls (only on suitable nodes) */}
          {canvasFields.length > 0 && (
            <div className={isOutput ? "mt-6 space-y-6" : "mt-4 space-y-4"}>
              {canvasFields.map(renderCanvasField)}
            </div>
          )}

          {/* Preview - always show for output node when connected, or when selected for others */}
          {(isOutput ? (connectedInput && (shouldShowPreview || true)) : shouldShowPreview) && (
            <div className={isOutput ? "mt-4" : "mt-4"}>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-widest text-white/45 mb-2">Preview</div>
                {isOutput && !shouldShowPreview && connectedInput ? (
                  <div className="text-[12px] text-white/60 italic">
                    Preview will appear here when the workflow runs.
                  </div>
                ) : (
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[12px] text-white/70">
                    {previewText}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ports */}
      {inputs.map((p, i) => {
        const pos = sideFor(p.id, "input");
        // For output nodes, position handle more towards center due to larger size
        const topOffset = isOutput ? 80 : 42;
        const style =
          pos === Position.Top || pos === Position.Bottom
            ? { left: "50%", transform: "translateX(-50%)" }
            : { top: topOffset + i * 18 };

        return (
          <Handle
            key={p.id}
            id={p.id}
            type="target"
            position={pos}
            className="edge-port edge-port--edg !h-3 !w-3 !z-50 !pointer-events-auto"
            style={style as any}
            isConnectable={isConnectable !== false}
          />
        );
      })}

      {outputs.map((p, i) => {
        const pos = sideFor(p.id, "output");
        const style =
          pos === Position.Top || pos === Position.Bottom
            ? { left: "50%", transform: "translateX(-50%)" }
            : { top: 42 + i * 18 };

        return (
          <Handle
            key={p.id}
            id={p.id}
            type="source"
            position={pos}
            className="edge-port edge-port--edg !h-3 !w-3 !z-50 !pointer-events-auto"
            style={style as any}
            isConnectable={isConnectable !== false}
          />
        );
      })}
    </div>
  );
}

export default memo(NodeFrameImpl);

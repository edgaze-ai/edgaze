// /src/components/builder/nodes/NodeCard.tsx
"use client";

import React from "react";
import { Handle, Position } from "reactflow";
import type { NodeSpec } from "../../../nodes/types";

type NodeCardData = {
  connectedNames?: string[];
  preview?: any;
  lastOutput?: any;
  output?: any;
  summaryOverride?: string;
};

/** Build a compact preview string from node data */
function buildPreview(data: NodeCardData | undefined, spec: NodeSpec): string {
  if (!data) return spec.summary ?? "";

  const candidate =
    data.preview ??
    data.lastOutput ??
    data.output ??
    data.summaryOverride ??
    spec.summary;

  if (candidate == null) return spec.summary ?? "";

  if (typeof candidate === "string") {
    return candidate.length > 220
      ? candidate.slice(0, 220).trimEnd() + "…"
      : candidate;
  }

  try {
    const json = JSON.stringify(candidate, null, 2);
    if (!json) return spec.summary ?? "";
    return json.length > 220 ? json.slice(0, 220).trimEnd() + "…" : json;
  } catch {
    return spec.summary ?? "";
  }
}

/** White, premium node with subtle Edgaze gradient ring + inline preview */
export default function NodeCard({
  spec,
  data,
  isConnectable = true,
  preview = false, // when true: don't render Handles
}: {
  spec: NodeSpec;
  data?: NodeCardData;
  isConnectable?: boolean;
  preview?: boolean;
}) {
  const inputs = (spec.ports ?? []).filter((p) => p.kind === "input");
  const outputs = (spec.ports ?? []).filter((p) => p.kind === "output");

  const previewText = buildPreview(data, spec);
  const connected = data?.connectedNames ?? [];

  const isMerge = spec.id === "merge";

  const shapeClass = isMerge
    ? "edge-ring rotate-45"
    : "edge-ring";

  const innerClass = isMerge
    ? "edge-card -rotate-45 min-w-[230px] max-w-[320px]"
    : "edge-card min-w-[240px] max-w-[340px]";

  return (
    <div className={shapeClass}>
      <div className={innerClass}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 px-3 pt-2 pb-1.5">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold">
              {spec.label}
            </div>
            <div className="mt-0.5 text-[11px] text-white/55 truncate">
              {spec.category || "Block"}
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 bg-black/40 px-2 py-[2px] text-[10px] font-mono text-white/70">
            v{spec.version ?? "1.0.0"}
          </span>
        </div>

        {/* Preview body */}
        <div className="px-3 pb-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] leading-5 text-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
            <div className="mb-1 flex items-center justify-between text-[10px] text-white/45">
              <span>Preview</span>
              {(inputs.length > 0 || outputs.length > 0) && (
                <span>
                  {inputs.length} in · {outputs.length} out
                </span>
              )}
            </div>
            <pre className="max-h-24 overflow-hidden whitespace-pre-wrap break-words">
              {previewText || "Run the workflow to see sample output here."}
            </pre>
          </div>

          {/* Connections */}
          <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-white/60">
            {connected.length ? (
              <>
                <span className="opacity-70">Connected to</span>
                {connected.slice(0, 4).map((n, i) => (
                  <span
                    key={i}
                    className="edge-badge bg-white/5 text-[10px] max-w-[120px] truncate"
                  >
                    {n}
                  </span>
                ))}
                {connected.length > 4 && (
                  <span className="edge-badge bg-white/5 text-[10px]">
                    +{connected.length - 4} more
                  </span>
                )}
              </>
            ) : (
              <span className="edge-badge bg-white/5 text-[10px] opacity-65">
                No outgoing connections
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Handles (hidden in preview mode for BlockLibrary) */}
      {!preview &&
        inputs.map((p, i) => (
          <Handle
            key={p.id}
            id={p.id}
            type="target"
            position={Position.Left}
            className="!bg-white !border !border-white/70 !h-2.5 !w-2.5"
            isConnectable={isConnectable}
            style={{ top: 30 + i * 18 }}
          />
        ))}

      {!preview &&
        outputs.map((p, i) => (
          <Handle
            key={p.id}
            id={p.id}
            type="source"
            position={Position.Right}
            className="!bg-white !border !border-white/70 !h-2.5 !w-2.5"
            isConnectable={isConnectable}
            style={{ top: 30 + i * 18 }}
          />
        ))}
    </div>
  );
}

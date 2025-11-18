// /src/components/builder/nodes/NodeCard.tsx
"use client";

import React from "react";
import { Handle, Position } from "reactflow";
import type { NodeSpec } from "../../../nodes/types";

/** White, premium node with subtle Edgaze gradient ring */
export default function NodeCard({
  spec,
  data,
  isConnectable = true,
  preview = false, // when true: don't render Handles
}: {
  spec: NodeSpec;
  data?: { connectedNames?: string[] };
  isConnectable?: boolean;
  preview?: boolean;
}) {
  const inputs = (spec.ports ?? []).filter((p) => p.kind === "input");
  const outputs = (spec.ports ?? []).filter((p) => p.kind === "output");

  // shape: merge is diamond, others rounded rect
  const shapeClass =
    spec.id === "merge"
      ? "edge-ring rotate-45"
      : "edge-ring";

  const innerClass =
    spec.id === "merge"
      ? "edge-card -rotate-45 min-w-[200px]"
      : "edge-card min-w-[220px]";

  return (
    <div className={shapeClass}>
      <div className={innerClass}>
        <div className="edge-card-header">
          <span className="truncate">{spec.label}</span>
          <span className="text-[10px] opacity-70">{spec.version ?? ""}</span>
        </div>
        <div className="edge-card-body">
          <div className="text-[11px] opacity-80">{spec.summary}</div>
          {(data?.connectedNames?.length ?? 0) > 0 && (
            <div className="mt-2">
              <div className="text-[10px] mb-1 opacity-60">Connected to</div>
              <div className="flex flex-wrap gap-1">
                {data!.connectedNames!.map((n, i) => (
                  <span key={i} className="edge-badge animate-pulse">
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {!preview &&
        inputs.map((p, i) => (
          <Handle
            key={p.id}
            id={p.id}
            type="target"
            position={Position.Left}
            className="!bg-white !border !border-white/70 !h-2.5 !w-2.5"
            isConnectable={isConnectable}
            style={{ top: 28 + i * 16 }}
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
            style={{ top: 28 + i * 16 }}
          />
        ))}
    </div>
  );
}

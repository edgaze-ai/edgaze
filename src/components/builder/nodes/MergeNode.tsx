"use client";

import React from "react";
import { Handle, Position, NodeProps, useStore } from "reactflow";

/** Edgaze selection ring */
function SelectionRing() {
  return (
    <div
      className="pointer-events-none absolute -inset-[6px] rounded-[16px]"
      style={{
        background:
          "linear-gradient(90deg, rgba(34,211,238,.95), rgba(232,121,249,.95))",
        padding: 2.5,
        WebkitMask:
          "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        WebkitMaskComposite: "xor",
        maskComposite: "exclude",
        boxShadow:
          "0 0 24px rgba(34,211,238,.25), 0 0 24px rgba(232,121,249,.25)",
      }}
    />
  );
}

export default function MergeNode(props: NodeProps) {
  const { selected, data, id } = props as any;

  // Build "connected to" list from store
  const { nodeInternals, edges } = useStore((s) => ({
    nodeInternals: s.nodeInternals,
    edges: s.edges,
  }));

  const connectedTo = React.useMemo(() => {
    const list = edges
      .filter((e) => e.source === id)
      .map((e) => {
        const n = nodeInternals.get(e.target);
        return (n?.data as any)?.title || n?.id || e.target;
      });
    const names = list.slice(0, 4).join(", ");
    return names + (list.length > 4 ? "…" : "");
  }, [edges, id, nodeInternals]);

  return (
    <div className="relative min-w-[380px]" data-nodeid={id}>
      {selected && <SelectionRing />}

      <div className="edge-card rounded-2xl relative">
        <div className="edge-card-header">
          <span className="truncate">Merge</span>
          <span className="text-[10px] opacity-70">{data?.version ?? "1.0.0"}</span>
        </div>
        <div className="edge-card-body">
          <div className="text-[12px] opacity-85">
            Combines multiple data streams into one unified output.
          </div>
          <div className="mt-2 text-[11px] opacity-70">
            {connectedTo && connectedTo.trim().length > 0
              ? `Connected to: ${connectedTo}`
              : "No outgoing connections yet"}
          </div>
        </div>
      </div>

      {/* Four fixed handles with Edgaze accents - positioned using React Flow's built-in positioning */}
      <Handle
        id="in-left"
        type="target"
        position={Position.Left}
        className="edge-port"
        isConnectable={true}
      />
      <Handle
        id="in-top"
        type="target"
        position={Position.Top}
        className="edge-port"
        isConnectable={true}
      />
      <Handle
        id="in-bottom"
        type="target"
        position={Position.Bottom}
        className="edge-port"
        isConnectable={true}
      />
      <Handle
        id="out-right"
        type="source"
        position={Position.Right}
        className="edge-port edge-port--edg"
        isConnectable={true}
      />
    </div>
  );
}

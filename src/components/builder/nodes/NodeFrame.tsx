"use client";

import { memo, useMemo } from "react";
import { Handle, Position, NodeProps, useStore } from "reactflow";
import { getNodeSpec } from "src/nodes/registry";

function SelectionRing() {
  return (
    <div
      className="pointer-events-none absolute -inset-[6px] rounded-[16px]"
      style={{
        background: "linear-gradient(90deg, rgba(34,211,238,.95), rgba(232,121,249,.95))",
        padding: 2.5,
        WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        WebkitMaskComposite: "xor",
        maskComposite: "exclude",
        boxShadow: "0 0 24px rgba(34,211,238,.25), 0 0 24px rgba(232,121,249,.25)",
      }}
    />
  );
}

function sideFor(id: string | undefined): Position {
  if (!id) return Position.Right;
  const k = id.toLowerCase();
  if (k.includes("left")) return Position.Left;
  if (k.includes("right")) return Position.Right;
  if (k.includes("top")) return Position.Top;
  if (k.includes("bottom")) return Position.Bottom;
  return Position.Right;
}

function NodeFrameImpl(props: NodeProps) {
  const { id, selected, data } = props as any;
  const spec = getNodeSpec(data?.specId);
  const title = spec?.label ?? data?.title ?? "Node";
  const version = spec?.version ?? data?.version ?? "1.0.0";
  const summary = spec?.summary ?? data?.summary ?? "";

  const inputs = (spec?.ports ?? []).filter((p) => p.kind === "input");
  const outputs = (spec?.ports ?? []).filter((p) => p.kind === "output");

  const { nodeInternals, edges } = useStore((s) => ({ nodeInternals: s.nodeInternals, edges: s.edges }));
  const connectedNames = useMemo(() => {
    const list = edges
      .filter((e) => e.source === id)
      .map((e) => nodeInternals.get(e.target))
      .map((n) => (n?.data?.title as string) || n?.id)
      .filter(Boolean) as string[];
    return list.slice(0, 4);
  }, [edges, id, nodeInternals]);

  return (
    <div className="relative" data-nodeid={id}>
      {selected && <SelectionRing />}
      <div className="edge-card min-w-[380px] rounded-2xl relative">
        <div className="edge-card-header">
          <span className="truncate">{title}</span>
          <span className="text-[10px] opacity-70">{version}</span>
        </div>
        <div className="edge-card-body">
          <div className="text-[12px] opacity-85">{summary}</div>
          <div className="mt-2 text-[10px] opacity-60">Connected to</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {connectedNames.length ? connectedNames.map((n, i) => <span key={i} className="edge-badge">{n}</span>) :
              <span className="edge-badge opacity-70">None yet</span>}
          </div>
        </div>
        <div className="edge-node-footer px-3 pb-2 pt-1 text-[11px] opacity-70">
          {inputs.length} in · {outputs.length} out
        </div>
      </div>

      {inputs.map((p, i) => {
        const pos = sideFor(p.id);
        const style = (pos === Position.Top || pos === Position.Bottom)
          ? { left: "50%", transform: "translateX(-50%)" }
          : { top: 34 + i * 18 };
        return (
          <Handle key={p.id} id={p.id} type="target" position={pos}
            className="edge-port edge-port--edg !h-3 !w-3" style={style as any} />
        );
      })}
      {outputs.map((p, i) => {
        const pos = sideFor(p.id);
        const style = (pos === Position.Top || pos === Position.Bottom)
          ? { left: "50%", transform: "translateX(-50%)" }
          : { top: 34 + i * 18 };
        return (
          <Handle key={p.id} id={p.id} type="source" position={pos}
            className="edge-port edge-port--edg !h-3 !w-3" style={style as any} />
        );
      })}
    </div>
  );
}

export default memo(NodeFrameImpl);

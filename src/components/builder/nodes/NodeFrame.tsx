"use client";

import { memo, useMemo } from "react";
import { Handle, Position, type NodeProps, useStore } from "reactflow";
import { getNodeSpec } from "src/nodes/registry";

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

function sideFor(id: string | undefined): Position {
  if (!id) return Position.Right;
  const k = id.toLowerCase();
  if (k.includes("left")) return Position.Left;
  if (k.includes("right")) return Position.Right;
  if (k.includes("top")) return Position.Top;
  if (k.includes("bottom")) return Position.Bottom;
  return Position.Right;
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
  const { id, selected, data } = props as any;

  const spec = getNodeSpec(data?.specId);

  const title: string = spec?.label ?? data?.title ?? "Node";
  const version: string = spec?.version ?? data?.version ?? "1.0.0";
  const summary: string = spec?.summary ?? data?.summary ?? "";
  const status: string | undefined = data?.status;

  const ports = spec?.ports ?? [];
  const inputs = ports.filter((p) => p.kind === "input");
  const outputs = ports.filter((p) => p.kind === "output");

  const previewText = useMemo(
    () => buildPreview(data, summary),
    [data, summary]
  );

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

  return (
    <div className="relative" data-nodeid={id}>
      {selected && <SelectionRing />}

      {/* Outer card – compact, premium */}
      <div className="edge-card relative min-w-[340px] max-w-[420px] rounded-2xl">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            {/* Tiny icon / avatar based on specId */}
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/5 text-[11px] font-semibold uppercase">
              {data?.icon ?? title.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold">
                {title}
              </div>
              <div className="mt-0.5 text-[11px] text-white/55 truncate">
                {summary || "Configure this block in the inspector."}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="shrink-0 rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] font-mono text-white/65">
              v{version}
            </span>
            {status && (
              <span className="rounded-full bg-emerald-400/10 px-2 py-[1px] text-[10px] font-medium text-emerald-300">
                {status}
              </span>
            )}
          </div>
        </div>

        {/* Preview area */}
        <div className="px-3 pb-2">
          <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 text-[11px] leading-5 text-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
            <div className="mb-1 flex items-center justify-between text-[10px] text-white/45">
              <span>Preview</span>
              {data?.lastRunAt && (
                <span>Updated {data.lastRunAt}</span>
              )}
            </div>
            <pre className="max-h-32 overflow-hidden whitespace-pre-wrap break-words">
              {previewText || "No sample yet – run this workflow to see output."}
            </pre>
          </div>
        </div>

        {/* Footer: ports + connections */}
        <div className="flex items-center justify-between gap-2 border-t border-white/8 px-3 py-1.5 text-[10px] text-white/55">
          <div className="flex items-center gap-2">
            <span>
              {inputs.length} in · {outputs.length} out
            </span>
            {ports.length > 0 && (
              <span className="h-1 w-1 rounded-full bg-white/25" />
            )}
            {ports.length > 0 && (
              <span className="truncate max-w-[120px]">
                {inputs
                  .map((p: any) => p.label || p.id)
                  .slice(0, 2)
                  .join(", ")}
                {inputs.length > 2 ? "…" : ""}
              </span>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-1 max-w-[160px]">
            {hasConnections ? (
              connectedNames.map((n, i) => (
                <span
                  key={i}
                  className="edge-badge bg-white/5 text-[10px] max-w-[110px] truncate"
                >
                  {n}
                </span>
              ))
            ) : (
              <span className="edge-badge bg-white/5 text-[10px] opacity-65">
                No outgoing connections
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Ports */}
      {inputs.map((p, i) => {
        const pos = sideFor(p.id);
        const style =
          pos === Position.Top || pos === Position.Bottom
            ? { left: "50%", transform: "translateX(-50%)" }
            : { top: 36 + i * 18 };

        return (
          <Handle
            key={p.id}
            id={p.id}
            type="target"
            position={pos}
            className="edge-port edge-port--edg !h-3 !w-3"
            style={style as any}
          />
        );
      })}

      {outputs.map((p, i) => {
        const pos = sideFor(p.id);
        const style =
          pos === Position.Top || pos === Position.Bottom
            ? { left: "50%", transform: "translateX(-50%)" }
            : { top: 36 + i * 18 };

        return (
          <Handle
            key={p.id}
            id={p.id}
            type="source"
            position={pos}
            className="edge-port edge-port--edg !h-3 !w-3"
            style={style as any}
          />
        );
      })}
    </div>
  );
}

export default memo(NodeFrameImpl);

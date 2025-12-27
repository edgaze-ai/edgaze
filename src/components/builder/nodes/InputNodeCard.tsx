import React, { useMemo } from "react";
import { Handle, Position, NodeProps } from "reactflow";

/**
 * Premium Input node:
 * - White Edgaze ring
 * - Small header + meta pill
 * - Compact preview of example payload / schema
 * - Single output handle on the right
 */
export default function InputNodeCard({ data }: NodeProps) {
  const title: string = data?.title ?? "Input";
  const description: string =
    data?.description ?? "Entry point for this workflow.";
  const connected: string[] = data?.outputs ?? ["payload"];

  // Optional richer preview: sample payload, schema, or description
  const previewText = useMemo(() => {
    const candidate =
      data?.sample ??
      data?.example ??
      data?.schema ??
      data?.preview ??
      description;

    if (candidate == null) return description;

    if (typeof candidate === "string") {
      return candidate.length > 220
        ? candidate.slice(0, 220).trimEnd() + "…"
        : candidate;
    }

    try {
      const json = JSON.stringify(candidate, null, 2);
      return json.length > 220 ? json.slice(0, 220).trimEnd() + "…" : json;
    } catch {
      return description;
    }
  }, [data, description]);

  return (
    <div className="edge-ring">
      <div className="edge-card min-w-[220px] max-w-[340px]">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 px-3 pt-2 pb-1.5">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold">{title}</div>
            <div className="mt-0.5 text-[11px] text-white/55 truncate">
              Workflow input
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 bg-black/40 px-2 py-[2px] text-[10px] font-mono text-white/70">
            IN
          </span>
        </div>

        {/* Preview body */}
        <div className="px-3 pb-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] leading-5 text-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
            <div className="mb-1 flex items-center justify-between text-[10px] text-white/45">
              <span>Expected input</span>
              <span className="uppercase tracking-[0.14em]">
                {connected[0] || "PAYLOAD"}
              </span>
            </div>
            <pre className="max-h-24 overflow-hidden whitespace-pre-wrap break-words">
              {previewText}
            </pre>
          </div>

          {/* Output chips */}
          {!!connected?.length && (
            <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-white/60">
              <span className="opacity-70">Exposes</span>
              {connected.map((c: string) => (
                <span
                  key={c}
                  className="edge-badge bg-white/5 text-[10px] max-w-[120px] truncate"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Handles: Input has only an output on the right */}
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className="!bg-white !border !border-white/70 !h-2.5 !w-2.5"
      />
    </div>
  );
}

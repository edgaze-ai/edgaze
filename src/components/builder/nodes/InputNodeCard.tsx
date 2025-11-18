import React from "react";
import { Handle, Position, NodeProps } from "reactflow";

/**
 * White node with subtle Edgaze ring; single output on the right.
 */
export default function InputNodeCard({ data, selected }: NodeProps) {
  const title = data?.title ?? "Input";
  const description = data?.description ?? "Start of the flow.";
  const connected = data?.outputs ?? ["data"];

  return (
    <div className="edge-ring">
      <div className="edge-card min-w-[180px]">
        <div className="edge-card-header">
          <span>{title}</span>
        </div>
        <div className="edge-card-body">
          <p className="opacity-80">{description}</p>
          {!!connected?.length && (
            <div className="mt-2 flex flex-wrap gap-1">
              {connected.map((c: string) => (
                <span key={c} className="edge-badge">{c}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Handles: Input has only an output on the right */}
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

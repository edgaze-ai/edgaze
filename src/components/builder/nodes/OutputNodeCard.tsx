import React from "react";
import { Handle, Position, NodeProps } from "reactflow";

/**
 * White node with subtle Edgaze ring; single input on the left.
 */
export default function OutputNodeCard({ data }: NodeProps) {
  const title = data?.title ?? "Output";
  const description = data?.description ?? "Result & formatting.";
  const connected = data?.inputs ?? ["data"];

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

      <Handle type="target" position={Position.Left} id="in" />
    </div>
  );
}

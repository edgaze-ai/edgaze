import React from "react";
import { Handle, Position, NodeProps } from "reactflow";

/**
 * Diamond node with 4 connectors (top/right/bottom/left).
 * We use a rotated wrapper to get a diamond while keeping upright content.
 */
export default function MergeDiamondNode({ data }: NodeProps) {
  const title = data?.title ?? "Merge";
  const description = data?.description ?? "Combines inputs into one stream.";
  const connected = data?.inputs ?? ["input1", "input2", "input3"];

  return (
    <div className="edge-diamond edge-ring" style={{ width: 160, height: 160 }}>
      <div className="edge-inner edge-card w-full h-full flex flex-col">
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

      {/* 4 handles */}
      <Handle type="target" position={Position.Top} id="in-top" />
      <Handle type="source" position={Position.Right} id="out-right" />
      <Handle type="target" position={Position.Bottom} id="in-bottom" />
      <Handle type="target" position={Position.Left} id="in-left" />
    </div>
  );
}

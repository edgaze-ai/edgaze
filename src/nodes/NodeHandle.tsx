"use client";

import React from "react";
import { Handle, Position, useStore } from "reactflow";

type HandleVariant = "data" | "true" | "false";

type NodeHandleProps = {
  nodeId: string;
  id: string;
  type: "source" | "target";
  position: Position;
  variant?: HandleVariant;
  nodeColor?: string;
  style?: React.CSSProperties;
  /** Override wrapper position (e.g. { top: "35%" } for condition node) */
  wrapperStyle?: React.CSSProperties;
  isConnectable?: boolean;
};

/**
 * Handle: 10px circle, position absolute on node edges.
 * NO labels — removed to fix "labels inside node body" bug.
 */
export function NodeHandle({
  nodeId,
  id,
  type,
  position,
  variant = "data",
  nodeColor = "#8b5cf6",
  style = {},
  wrapperStyle,
  isConnectable = true,
}: NodeHandleProps) {
  const edges = useStore((s) => s.edges);

  const isConnected =
    type === "source"
      ? edges.some((e) => e.source === nodeId && (e.sourceHandle == null || e.sourceHandle === id))
      : edges.some((e) => e.target === nodeId && (e.targetHandle == null || e.targetHandle === id));

  const handleColor =
    variant === "true" ? "#22c55e" : variant === "false" ? "#ef4444" : nodeColor;

  const isLeft = position === Position.Left;

  const baseWrapperStyle: React.CSSProperties =
    position === Position.Left
      ? { left: 0, top: "50%", transform: "translateY(-50%)" }
      : position === Position.Right
        ? { right: 0, top: "50%", transform: "translateY(-50%)" }
        : position === Position.Top
          ? { left: "50%", top: 0, transform: "translateX(-50%)" }
          : { left: "50%", bottom: 0, transform: "translateX(-50%)" };

  return (
    <div
      className="node-handle-wrapper"
      style={{
        position: "absolute",
        ...baseWrapperStyle,
        ...wrapperStyle,
      }}
    >
      <Handle
          id={id}
          type={type}
          position={position}
          isConnectable={isConnectable}
          className="node-handle-custom"
          style={{
            width: 10,
            height: 10,
            minWidth: 10,
            minHeight: 10,
            borderRadius: "50%",
            background: isConnected ? handleColor : "#141414",
            border: `2px solid ${isConnected ? handleColor : "#383838"}`,
            padding: 0,
            margin: 0,
            cursor: "crosshair",
            transition: "all 120ms",
            zIndex: 10,
            boxShadow: isConnected ? `0 0 5px ${handleColor}44` : "none",
            ...(isLeft ? { left: -5 } : { right: -5 }),
            ...style,
          }}
        />
    </div>
  );
}

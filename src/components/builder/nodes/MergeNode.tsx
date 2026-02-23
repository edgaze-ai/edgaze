"use client";

import React from "react";
import { Handle, Position, NodeProps, useStore } from "reactflow";

const MERGE_COLOR = "#f59e0b";

const NODE_HEADER = 42;
const NODE_BODY = 50;
const NODE_FOOTER = 24;
const NODE_TOTAL = NODE_HEADER + NODE_BODY + NODE_FOOTER;

// Handle Y positions as percentage (handles are absolute, don't affect layout)
const HANDLE_POSITIONS: Record<number, number[]> = {
  2: [38, 62],
  3: [28, 50, 72],
  4: [22, 38, 62, 78],
  5: [20, 35, 50, 65, 80],
  6: [18, 32, 46, 60, 74, 88],
};

export default function MergeNode(props: NodeProps) {
  const { selected, data, id } = props as any;

  const { edges } = useStore((s) => ({ edges: s.edges }));
  const inputCount = edges.filter((e) => e.target === id).length;
  const handleCount = 3;
  const positions = HANDLE_POSITIONS[handleCount];

  const isHandleConnected = (handleId: string, isSource: boolean) =>
    isSource
      ? edges.some((e) => e.source === id && (e.sourceHandle == null || e.sourceHandle === handleId))
      : edges.some((e) => e.target === id && (e.targetHandle == null || e.targetHandle === handleId));

  return (
    <div
      className="relative"
      data-nodeid={id}
      style={{
        width: 240,
        background: "#161616",
        border: `1px solid ${selected ? MERGE_COLOR : "#2a2a2a"}`,
        borderRadius: 8,
        boxShadow: selected
          ? `0 0 0 1px ${MERGE_COLOR}33, 0 8px 32px rgba(0,0,0,0.65), 0 0 40px ${MERGE_COLOR}08`
          : "0 4px 20px rgba(0,0,0,0.55), 0 1px 4px rgba(0,0,0,0.4)",
        overflow: "visible",
        position: "relative",
        transition: "border-color 150ms, box-shadow 150ms",
      }}
    >
      {/* Left accent bar */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: MERGE_COLOR,
          borderRadius: "8px 0 0 8px",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <div
        style={{
          height: NODE_HEADER,
          background: "#1e1e1e",
          borderBottom: "1px solid #242424",
          borderRadius: "8px 8px 0 0",
          padding: "0 12px 0 14px",
          display: "flex",
          alignItems: "center",
          gap: 9,
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            background: `${MERGE_COLOR}15`,
            border: `1px solid ${MERGE_COLOR}28`,
            borderRadius: 5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke={MERGE_COLOR}
            strokeWidth="2"
          >
            <path d="M8 6h8v12H8z" />
            <path d="M4 12h4" />
            <path d="M16 12h4" />
          </svg>
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "#e8e8e8",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          Merge
        </span>
      </div>

      {/* Body — NO padding for handles, min-height 0 */}
      <div
        style={{
          padding: "10px 12px 10px 14px",
          background: "#161616",
          minHeight: 0,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: "#606060",
            fontStyle: "italic",
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            margin: 0,
            padding: 0,
          }}
        >
          Merging {inputCount} inputs
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          height: NODE_FOOTER,
          background: "#121212",
          borderTop: "1px solid #1c1c1c",
          borderRadius: "0 0 8px 8px",
          padding: "0 12px 0 14px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <span style={{ fontFamily: "monospace", fontSize: 9, color: "#282828" }}>
          #{id.slice(0, 6)}
        </span>
      </div>

      {/* Input handles — absolute on left edge, percentage positions */}
      {Array.from({ length: handleCount }, (_, i) => {
        const handleId = `in-${i + 1}`;
        const topPercent = positions?.[i] ?? 50;
        const connected = isHandleConnected(handleId, false);
        return (
          <Handle
            key={handleId}
            id={handleId}
            type="target"
            position={Position.Left}
            isConnectable
            className="node-handle-custom"
            style={{
              position: "absolute",
              left: -5,
              top: `${topPercent}%`,
              transform: "translateY(-50%)",
              width: 10,
              height: 10,
              minWidth: 10,
              minHeight: 10,
              borderRadius: "50%",
              background: connected ? MERGE_COLOR : "#161616",
              border: `2px solid ${connected ? MERGE_COLOR : "#383838"}`,
              boxShadow: connected ? `0 0 5px ${MERGE_COLOR}44` : "none",
              padding: 0,
              margin: 0,
              cursor: "crosshair",
              transition: "all 120ms",
              zIndex: 10,
            }}
          />
        );
      })}

      {/* Output handle */}
      <Handle
        id="out"
        type="source"
        position={Position.Right}
        isConnectable
        className="node-handle-custom"
        style={{
          position: "absolute",
          right: -5,
          top: "50%",
          transform: "translateY(-50%)",
          width: 10,
          height: 10,
          minWidth: 10,
          minHeight: 10,
          borderRadius: "50%",
          background: isHandleConnected("out", true) ? MERGE_COLOR : "#161616",
          border: `2px solid ${isHandleConnected("out", true) ? MERGE_COLOR : "#383838"}`,
          boxShadow: isHandleConnected("out", true) ? `0 0 5px ${MERGE_COLOR}44` : "none",
          padding: 0,
          margin: 0,
          cursor: "crosshair",
          transition: "all 120ms",
          zIndex: 10,
        }}
      />
    </div>
  );
}

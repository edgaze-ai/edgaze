"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, useStore } from "reactflow";
import { GitBranch } from "lucide-react";

function getConditionLabel(config: { operator?: string; compareValue?: string; humanCondition?: string }): string {
  const operator = config?.operator || "truthy";
  const compareValue = String(config?.compareValue ?? "").slice(0, 30);
  if (String(config?.humanCondition ?? "").trim()) {
    return String(config.humanCondition).trim().slice(0, 40) + (String(config.humanCondition).length > 40 ? "…" : "");
  }
  switch (operator) {
    case "truthy":
      return "is truthy";
    case "falsy":
      return "is falsy";
    case "equals":
      return `equals "${compareValue}"`;
    case "notEquals":
      return `does not equal "${compareValue}"`;
    case "gt":
      return `> ${compareValue}`;
    case "lt":
      return `< ${compareValue}`;
    default:
      return compareValue || "No condition set";
  }
}

function ConditionNodeImpl(props: NodeProps) {
  const { id, selected, data } = props as any;
  const config = data?.config ?? {};
  const conditionLabel = getConditionLabel(config);

  const edges = useStore((s) => s.edges);
  const isHandleConnected = (handleId: string, isSource: boolean) =>
    isSource
      ? edges.some((e) => e.source === id && (e.sourceHandle == null || e.sourceHandle === handleId))
      : edges.some((e) => e.target === id && (e.targetHandle == null || e.targetHandle === handleId));

  const trueConnected = isHandleConnected("true", true);
  const falseConnected = isHandleConnected("false", true);
  const TRUE_COLOR = "#22c55e";
  const FALSE_COLOR = "#ef4444";
  const AMBER = "#f59e0b";

  return (
    <div
      className="relative"
      data-nodeid={id}
      style={{
        width: 260,
        background: "#161616",
        border: `1px solid ${selected ? AMBER : "#2a2a2a"}`,
        borderRadius: 8,
        boxShadow: selected
          ? "0 0 0 1px rgba(245,158,11,0.25), 0 6px 28px rgba(0,0,0,0.6)"
          : "0 4px 20px rgba(0,0,0,0.55)",
        overflow: "visible",
        position: "relative",
        transition: "border-color 150ms, box-shadow 150ms",
      }}
    >
      {/* Left accent bar — gradient amber to red */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: "linear-gradient(180deg, #f59e0b 0%, #ef4444 100%)",
          borderRadius: "8px 0 0 8px",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />

      {/* Node header */}
      <div
        style={{
          height: 42,
          background: "#1e1e1e",
          borderBottom: "1px solid #242424",
          borderRadius: "8px 8px 0 0",
          padding: "0 12px 0 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            background: "rgba(245,158,11,0.12)",
            border: "1px solid rgba(245,158,11,0.22)",
            borderRadius: 5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <GitBranch size={14} color={AMBER} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 500, color: "#e2e2e2", flex: 1 }}>Condition</span>
        <span
          style={{
            fontSize: 9,
            color: "#333",
            background: "#111",
            border: "1px solid #1e1e1e",
            borderRadius: 999,
            padding: "2px 6px",
          }}
        >
          v1.0.0
        </span>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#252525",
            border: "1px solid #2e2e2e",
            flexShrink: 0,
          }}
        />
      </div>

      {/* Node body — extra right padding to avoid overlap with handle labels */}
      <div style={{ padding: "10px 40px 10px 14px", background: "#161616" }}>
        {/* Condition preview */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: AMBER }}>IF</div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: conditionLabel === "No condition set" ? "#444" : "#e0e0e0",
              fontStyle: conditionLabel === "No condition set" ? "italic" : "normal",
              marginTop: 2,
            }}
          >
            {conditionLabel === "No condition set" ? (
              <span style={{ fontSize: 11 }}>No condition set</span>
            ) : (
              conditionLabel
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "#1e1e1e", margin: "8px 0" }} />

        {/* Output preview rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: TRUE_COLOR,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 10, fontWeight: 500, color: TRUE_COLOR }}>True →</span>
            <span style={{ fontSize: 10, color: "#444" }}>continue if condition passes</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: FALSE_COLOR,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 10, fontWeight: 500, color: FALSE_COLOR }}>False →</span>
            <span style={{ fontSize: 10, color: "#444" }}>continue if condition fails</span>
          </div>
        </div>
      </div>

      {/* Node footer */}
      <div
        style={{
          height: 24,
          background: "#111",
          borderTop: "1px solid #1c1c1c",
          borderRadius: "0 0 8px 8px",
          padding: "0 12px 0 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontFamily: "monospace", fontSize: 9, color: "#282828" }}>#{id.slice(0, 8)}</span>
        <span style={{ fontSize: 9, color: "#333" }}>—</span>
      </div>

      {/* Input handle (left, centered) — direct child for React Flow connection detection */}
      <Handle
        id="input"
        type="target"
        position={Position.Left}
        isConnectable
        className="node-handle-custom"
        style={{
          position: "absolute",
          left: -5,
          top: "50%",
          transform: "translateY(-50%)",
          width: 10,
          height: 10,
          minWidth: 10,
          minHeight: 10,
          borderRadius: "50%",
          background: isHandleConnected("input", false) ? AMBER : "#161616",
          border: `2px solid ${isHandleConnected("input", false) ? AMBER : "#383838"}`,
          boxShadow: isHandleConnected("input", false) ? `0 0 5px ${AMBER}44` : "none",
          padding: 0,
          margin: 0,
          cursor: "crosshair",
          transition: "all 120ms",
          zIndex: 10,
        }}
      />

      {/* True output handle */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: "62%",
          transform: "translateY(-50%)",
          width: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        <span
          style={{
            position: "absolute",
            right: 14,
            fontSize: 9,
            color: TRUE_COLOR,
            fontWeight: 600,
            pointerEvents: "none",
          }}
        >
          true
        </span>
        <Handle
          id="true"
          type="source"
          position={Position.Right}
          isConnectable
          className="node-handle-custom condition-handle-true"
          style={{
            right: -5,
            width: 10,
            height: 10,
            minWidth: 10,
            minHeight: 10,
            borderRadius: "50%",
            background: trueConnected ? TRUE_COLOR : "#161616",
            border: `2px solid ${trueConnected ? TRUE_COLOR : "#22c55e66"}`,
            boxShadow: trueConnected ? `0 0 5px ${TRUE_COLOR}44` : "none",
            padding: 0,
            margin: 0,
            cursor: "crosshair",
            transition: "all 120ms",
            zIndex: 10,
          }}
        />
      </div>

      {/* False output handle */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: "78%",
          transform: "translateY(-50%)",
          width: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        <span
          style={{
            position: "absolute",
            right: 14,
            fontSize: 9,
            color: FALSE_COLOR,
            fontWeight: 600,
            pointerEvents: "none",
          }}
        >
          false
        </span>
        <Handle
          id="false"
          type="source"
          position={Position.Right}
          isConnectable
          className="node-handle-custom condition-handle-false"
          style={{
            right: -5,
            width: 10,
            height: 10,
            minWidth: 10,
            minHeight: 10,
            borderRadius: "50%",
            background: falseConnected ? FALSE_COLOR : "#161616",
            border: `2px solid ${falseConnected ? FALSE_COLOR : "#ef444466"}`,
            boxShadow: falseConnected ? `0 0 5px ${FALSE_COLOR}44` : "none",
            padding: 0,
            margin: 0,
            cursor: "crosshair",
            transition: "all 120ms",
            zIndex: 10,
          }}
        />
      </div>
    </div>
  );
}

export default memo(ConditionNodeImpl);

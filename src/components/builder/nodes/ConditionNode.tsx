"use client";

import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { getNodeSpec } from "src/nodes/registry";

function SelectionRing() {
  return (
    <div
      className="pointer-events-none absolute -inset-[7px] rounded-[18px]"
      style={{
        background: "linear-gradient(120deg, rgba(56,189,248,0.95), rgba(244,114,182,0.95))",
        padding: 2.5,
        WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        WebkitMaskComposite: "xor",
        maskComposite: "exclude",
        boxShadow: "0 0 26px rgba(56,189,248,0.33), 0 0 26px rgba(244,114,182,0.33)",
      }}
    />
  );
}

function ConditionNodeImpl(props: NodeProps) {
  const { id, selected, data } = props as any;
  const spec = getNodeSpec(data?.specId);
  const config = data?.config ?? {};
  const operator = config.operator || "truthy";
  const compareValue = config.compareValue ?? "";

  const [hoveredOutput, setHoveredOutput] = useState<"true" | "false" | null>(null);

  // Build condition preview text (escape compareValue to prevent XSS from user-editable config)
  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  const conditionText = (() => {
    if (operator === "truthy") return "is truthy";
    if (operator === "falsy") return "is falsy";
    if (operator === "equals") return `equals "${escapeHtml(String(compareValue))}"`;
    if (operator === "notEquals") return `does not equal "${escapeHtml(String(compareValue))}"`;
    if (operator === "gt") return `&gt; ${escapeHtml(String(compareValue))}`;
    if (operator === "lt") return `&lt; ${escapeHtml(String(compareValue))}`;
    return escapeHtml(String(operator));
  })();

  // Triangle dimensions
  const triangleSize = 120;
  const triangleHeight = triangleSize * 0.866; // Equilateral triangle height

  return (
    <div className="relative" data-nodeid={id} style={{ width: `${triangleSize}px`, height: `${triangleHeight}px` }}>
      {selected && <SelectionRing />}

      {/* Triangle shape - pointing right */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={triangleSize}
        height={triangleHeight}
        viewBox={`0 0 ${triangleSize} ${triangleHeight}`}
        style={{ overflow: "visible" }}
      >
        {/* Triangle path: left corner (input), top-right (true), bottom-right (false) */}
        <polygon
          points={`0,${triangleHeight / 2} ${triangleSize},0 ${triangleSize},${triangleHeight}`}
          fill="rgba(20, 20, 24, 0.95)"
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth="1.5"
        />
        {/* Gradient overlay */}
        <defs>
          <linearGradient id={`condition-triangle-${id}`} x1="0%" y1="0%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="rgba(34, 211, 238, 0.15)" />
            <stop offset="50%" stopColor="rgba(168, 85, 247, 0.15)" />
            <stop offset="100%" stopColor="rgba(236, 72, 153, 0.15)" />
          </linearGradient>
        </defs>
        <polygon
          points={`0,${triangleHeight / 2} ${triangleSize},0 ${triangleSize},${triangleHeight}`}
          fill={`url(#condition-triangle-${id})`}
          opacity="0.6"
        />
      </svg>

      {/* Condition text in center */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center px-2">
          <div className="text-[10px] font-semibold text-white/90 mb-0.5">If value</div>
          <div className="text-[9px] text-white/70" dangerouslySetInnerHTML={{ __html: conditionText }} />
        </div>
      </div>

      {/* True output (top-right corner) - Green */}
      <div
        className="absolute"
        style={{
          top: "0px",
          right: "0px",
          transform: "translate(50%, -50%)",
        }}
        onMouseEnter={() => setHoveredOutput("true")}
        onMouseLeave={() => setHoveredOutput(null)}
      >
        <Handle
          id="true"
          type="source"
          position={Position.Right}
          className="edge-port edge-port--edg !h-4 !w-4 !bg-emerald-500 !border-emerald-400"
          style={{ right: "-8px", top: "0px" }}
        />
        {hoveredOutput === "true" && (
          <div className="absolute top-6 right-0 whitespace-nowrap bg-emerald-500/90 text-white text-[10px] px-2 py-1 rounded shadow-lg z-50 pointer-events-none">
            True
          </div>
        )}
      </div>

      {/* False output (bottom-right corner) - Red */}
      <div
        className="absolute"
        style={{
          bottom: "0px",
          right: "0px",
          transform: "translate(50%, 50%)",
        }}
        onMouseEnter={() => setHoveredOutput("false")}
        onMouseLeave={() => setHoveredOutput(null)}
      >
        <Handle
          id="false"
          type="source"
          position={Position.Right}
          className="edge-port edge-port--edg !h-4 !w-4 !bg-rose-500 !border-rose-400"
          style={{ right: "-8px", bottom: "0px" }}
        />
        {hoveredOutput === "false" && (
          <div className="absolute bottom-6 right-0 whitespace-nowrap bg-rose-500/90 text-white text-[10px] px-2 py-1 rounded shadow-lg z-50 pointer-events-none">
            False
          </div>
        )}
      </div>

      {/* Input handle (left corner, centered) */}
      <Handle
        id="input"
        type="target"
        position={Position.Left}
        className="edge-port edge-port--edg !h-4 !w-4"
        style={{
          left: "-8px",
          top: "50%",
          transform: "translateY(-50%)",
          padding: '8px',
          margin: '-8px',
        }}
      />
    </div>
  );
}

export default memo(ConditionNodeImpl);

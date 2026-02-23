"use client";

import React from "react";
import { getBezierPath, type EdgeProps } from "reactflow";

/**
 * Custom edge: smooth bezier curves with cyan→pink gradient.
 * NOT smoothstep (which causes white rectangles).
 * gradientUnits="userSpaceOnUse" for correct gradient direction.
 */
export function GradientEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  selected,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <defs>
        <linearGradient
          id="edge-gradient"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      {/* Glow layer */}
      <path
        d={edgePath}
        stroke="url(#edge-gradient)"
        strokeWidth={6}
        fill="none"
        opacity={0.07}
        style={{ filter: "blur(3px)", ...style }}
      />
      {/* Main line */}
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        stroke="url(#edge-gradient)"
        strokeWidth={1.5}
        fill="none"
        opacity={selected ? 0.9 : 0.45}
        style={style}
      />
    </>
  );
}

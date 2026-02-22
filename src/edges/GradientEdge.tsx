"use client";

import React from "react";
import {
  getBezierPath,
  type EdgeProps,
} from "reactflow";

/**
 * Custom edge with a cyan-to-purple gradient stroke.
 * Used as the default edge type in the workflow canvas.
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
  const gradientId = `edgaze-edge-gradient-${id}`;
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
        <linearGradient id={gradientId} gradientTransform="rotate(90)">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        stroke={`url(#${gradientId})`}
        strokeWidth={selected ? 2.5 : 2}
        fill="none"
        style={style}
      />
    </>
  );
}

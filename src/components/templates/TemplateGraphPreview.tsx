"use client";

import React, { memo, useMemo } from "react";
import ReactFlow, { Background, BackgroundVariant } from "reactflow";
import "reactflow/dist/style.css";
import { BaseNode } from "@/nodes/BaseNode";
import MergeNode from "@/components/builder/nodes/MergeNode";
import ConditionNode from "@/components/builder/nodes/ConditionNode";
import { CustomEdge } from "@/edges/CustomEdge";
import type { TemplatePreviewGraph } from "@/lib/templates";

const nodeTypes = Object.freeze({
  edgCard: BaseNode,
  edgMerge: MergeNode,
  edgCondition: ConditionNode,
});

const edgeTypes = Object.freeze({
  default: CustomEdge,
  gradient: CustomEdge,
  simplebezier: CustomEdge,
});

function TemplateGraphPreview({
  graph,
  className = "",
  compact = false,
  fitViewPadding = 0.16,
}: {
  graph: TemplatePreviewGraph;
  className?: string;
  compact?: boolean;
  fitViewPadding?: number;
}) {
  const nodes = useMemo(
    () =>
      graph.nodes.map((node) => ({
        ...node,
        selected: false,
        draggable: false,
        selectable: false,
      })),
    [graph.nodes],
  );

  const edges = useMemo(
    () =>
      graph.edges.map((edge) => ({
        ...edge,
        selectable: false,
      })),
    [graph.edges],
  );

  return (
    <div
      className={[
        "relative overflow-hidden rounded-[16px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.03),transparent_26%),linear-gradient(180deg,rgba(17,17,19,1),rgba(10,10,11,1))] shadow-[0_20px_60px_rgba(0,0,0,0.4)]",
        compact ? "h-36" : "h-[300px]",
        className,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_center,transparent_52%,rgba(0,0,0,0.38)_100%)]" />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: fitViewPadding, includeHiddenNodes: true }}
        minZoom={0.1}
        maxZoom={1.3}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnPinch={false}
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        panOnDrag={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
        className="template-graph-preview"
      >
        <Background
          id="template-preview-grid"
          variant={BackgroundVariant.Dots}
          gap={18}
          size={0.9}
          color="rgba(255,255,255,0.035)"
        />
      </ReactFlow>
    </div>
  );
}

export default memo(TemplateGraphPreview);

"use client";

import React, { useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Edge,
  Node,
  NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";

import { CustomEdge } from "../../../edges/CustomEdge";
import { normalizeGraph } from "../../builder/graph-normalize";
import ConditionNode from "../../builder/nodes/ConditionNode";
import MergeNode from "../../builder/nodes/MergeNode";
import { BaseNode } from "../../../nodes/BaseNode";
import type { WorkflowRunGraph } from "../../../lib/workflow/run-types";

type CustomerRunNodeStageProps = {
  graph?: WorkflowRunGraph;
  activeNodeIds: string[];
  className?: string;
};

type StageNodeData = {
  specId?: string;
  title?: string;
  config?: any;
  status?: "idle" | "running" | "success" | "error";
  errorMessage?: string;
};

const nodeTypes = Object.freeze({
  edgCard: BaseNode as React.ComponentType<NodeProps<StageNodeData>>,
  edgMerge: MergeNode,
  edgCondition: ConditionNode,
});

const edgeTypes = Object.freeze({
  default: CustomEdge,
  gradient: CustomEdge,
  simplebezier: CustomEdge,
});

function buildFallbackPosition(index: number) {
  return { x: index * 260, y: index % 2 === 0 ? 0 : 48 };
}

function useFocusedGraph(graph: WorkflowRunGraph | undefined, activeNodeIds: string[]) {
  return useMemo(() => {
    if (!graph || activeNodeIds.length === 0) {
      return { nodes: [] as Node<StageNodeData>[], edges: [] as Edge[] };
    }

    const activeSet = new Set(activeNodeIds);
    const sourceNodes = graph.nodes.filter((node) => activeSet.has(node.id));
    const sourceEdges = graph.edges.filter(
      (edge) => activeSet.has(edge.source) || activeSet.has(edge.target),
    );

    const normalized = normalizeGraph({
      nodes: sourceNodes.map((node, index) => ({
        id: node.id,
        type: node.type,
        position: node.position ?? buildFallbackPosition(index),
        data: {
          ...(node.data ?? {}),
          status: activeSet.has(node.id) ? "running" : "idle",
        },
      })),
      edges: sourceEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        type: edge.type,
      })),
    });

    return {
      nodes: normalized.nodes as Node<StageNodeData>[],
      edges: normalized.edges as Edge[],
    };
  }, [graph, activeNodeIds]);
}

export default function CustomerRunNodeStage({
  graph,
  activeNodeIds,
  className,
}: CustomerRunNodeStageProps) {
  const { nodes, edges } = useFocusedGraph(graph, activeNodeIds);

  if (nodes.length === 0) return null;

  return (
    <div
      className={
        className ??
        "relative h-[320px] w-full overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(67,214,255,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,70,201,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] shadow-[0_28px_90px_rgba(0,0,0,0.38)]"
      }
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_55%)] runtime-stage-orb" />
      <div className="pointer-events-none absolute inset-0 opacity-90 runtime-stage-glaze [background-image:linear-gradient(112deg,transparent_0%,transparent_28%,rgba(81,220,255,0.04)_36%,rgba(81,220,255,0.18)_42%,rgba(255,255,255,0.30)_46%,rgba(255,102,214,0.20)_52%,rgba(255,102,214,0.07)_58%,transparent_68%,transparent_100%),linear-gradient(112deg,transparent_0%,transparent_42%,rgba(109,233,255,0.07)_48%,rgba(255,255,255,0.18)_52%,rgba(255,102,214,0.10)_58%,transparent_66%,transparent_100%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] [background-size:180%_100%,120%_100%,100%_100%] [mix-blend-mode:screen]" />
      <div className="absolute inset-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnScroll={false}
          panOnScroll={false}
          panOnDrag={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          onInit={(instance) => {
            window.setTimeout(() => {
              instance.fitView({
                padding: 0.35,
                duration: 500,
                minZoom: 0.45,
                maxZoom: 1.35,
              });
            }, 40);
          }}
          defaultEdgeOptions={{ type: "gradient" }}
        >
          <Background
            color="rgba(255,255,255,0.06)"
            gap={22}
            size={1}
            variant={BackgroundVariant.Dots}
          />
        </ReactFlow>
      </div>
    </div>
  );
}

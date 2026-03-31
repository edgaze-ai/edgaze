"use client";

import React, { useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Edge,
  Node,
  NodeProps,
  useReactFlow,
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

/** Compact horizontal strip centered on the origin so fitView always frames a stable bbox. */
function stagePositionsForCount(count: number, gap = 300): { x: number; y: number }[] {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 0, y: 0 }];
  const span = (count - 1) * gap;
  const startX = -span / 2;
  return Array.from({ length: count }, (_, i) => ({ x: startX + i * gap, y: 0 }));
}

function useFocusedGraph(graph: WorkflowRunGraph | undefined, activeNodeIds: string[]) {
  return useMemo(() => {
    if (!graph || activeNodeIds.length === 0) {
      return { nodes: [] as Node<StageNodeData>[], edges: [] as Edge[] };
    }

    const activeSet = new Set(activeNodeIds);
    const sourceNodes = activeNodeIds
      .map((id) => graph.nodes.find((node) => node.id === id))
      .filter((node): node is NonNullable<typeof node> => Boolean(node));
    const sourceEdges = graph.edges.filter(
      (edge) => activeSet.has(edge.source) || activeSet.has(edge.target),
    );

    const positions = stagePositionsForCount(sourceNodes.length);

    const normalized = normalizeGraph({
      nodes: sourceNodes.map((node, index) => ({
        id: node.id,
        type: node.type,
        position: positions[index] ?? { x: 0, y: 0 },
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

const FIT_VIEW_OPTIONS = {
  padding: 0.45,
  duration: 220,
  minZoom: 0.45,
  maxZoom: 1.35,
} as const;

/** Refits whenever the focused subgraph changes (onInit alone misses updates and caused off-center glitches). */
function CustomerRunStageFitView({ signature }: { signature: string }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (!signature) return;
    let cancelled = false;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (!cancelled) void fitView(FIT_VIEW_OPTIONS);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [signature, fitView]);

  return null;
}

export default function CustomerRunNodeStage({
  graph,
  activeNodeIds,
  className,
}: CustomerRunNodeStageProps) {
  const { nodes, edges } = useFocusedGraph(graph, activeNodeIds);
  const fitSignature = useMemo(
    () => `${activeNodeIds.join("\0")}|${nodes.map((n) => n.id).join("\0")}|${edges.map((e) => e.id).join("\0")}`,
    [activeNodeIds, nodes, edges],
  );

  const shellClass =
    className ??
    "relative h-[320px] w-full min-h-[320px] overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(67,214,255,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,70,201,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] shadow-[0_28px_90px_rgba(0,0,0,0.38)]";

  if (nodes.length === 0) {
    return (
      <div className={shellClass}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_55%)] runtime-stage-orb" />
        <div className="pointer-events-none absolute inset-0 opacity-90 runtime-stage-glaze [background-image:linear-gradient(112deg,transparent_0%,transparent_28%,rgba(81,220,255,0.04)_36%,rgba(81,220,255,0.18)_42%,rgba(255,255,255,0.30)_46%,rgba(255,102,214,0.20)_52%,rgba(255,102,214,0.07)_58%,transparent_68%,transparent_100%),linear-gradient(112deg,transparent_0%,transparent_42%,rgba(109,233,255,0.07)_48%,rgba(255,255,255,0.18)_52%,rgba(255,102,214,0.10)_58%,transparent_66%,transparent_100%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] [background-size:180%_100%,120%_100%,100%_100%] [mix-blend-mode:screen]" />
        <div className="flex h-full min-h-[320px] items-center justify-center px-6 text-center text-sm text-white/48">
          Syncing node layout…
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_55%)] runtime-stage-orb" />
      <div className="pointer-events-none absolute inset-0 opacity-90 runtime-stage-glaze [background-image:linear-gradient(112deg,transparent_0%,transparent_28%,rgba(81,220,255,0.04)_36%,rgba(81,220,255,0.18)_42%,rgba(255,255,255,0.30)_46%,rgba(255,102,214,0.20)_52%,rgba(255,102,214,0.07)_58%,transparent_68%,transparent_100%),linear-gradient(112deg,transparent_0%,transparent_42%,rgba(109,233,255,0.07)_48%,rgba(255,255,255,0.18)_52%,rgba(255,102,214,0.10)_58%,transparent_66%,transparent_100%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] [background-size:180%_100%,120%_100%,100%_100%] [mix-blend-mode:screen]" />
      <div className="absolute inset-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView={nodes.length > 0}
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
          defaultEdgeOptions={{ type: "gradient" }}
        >
          {nodes.length > 0 && <CustomerRunStageFitView signature={fitSignature} />}
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

"use client";

import React, { memo, useMemo } from "react";
import { Position, type NodeProps, useStore } from "reactflow";
import { AlertTriangle } from "lucide-react";
import { getNodeSpec } from "./registry";
import { getNodeRegistryEntry } from "./NODE_REGISTRY";
import { NodeHandle } from "./NodeHandle";

import {
  ArrowRight,
  ArrowLeft,
  GitMerge,
  GitBranch,
  Timer,
  Repeat,
  MessageSquare,
  Braces,
  Image,
  Globe,
  FileText,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string; style?: any }>> = {
  ArrowRight,
  ArrowLeft,
  GitMerge,
  GitBranch,
  Timer,
  Repeat,
  MessageSquare,
  Braces,
  Image,
  Globe,
  FileText,
};

function getIconComponent(iconName: string) {
  return ICON_MAP[iconName] ?? MessageSquare;
}

function buildPreview(specId: string, config: any, edges: any[], nodeId: string): string {
  if (!config || typeof config !== "object") return "Not configured";

  switch (specId) {
    case "input":
      return `Key: ${config.inputKey ?? config.name ?? "Not set"}`;
    case "output":
      return `Format: ${config.format ?? "json"}`;
    case "merge": {
      const inputCount = edges.filter((e) => e.target === nodeId).length;
      return `Merging ${inputCount} inputs`;
    }
    case "openai-chat": {
      const p = String(config.prompt ?? "").trim();
      return p ? (p.length > 70 ? p.slice(0, 70) + "…" : p) : "No prompt set";
    }
    case "openai-image":
      return `Size: ${config.size ?? "1024x1024"} · ${config.n ?? 1} image(s)`;
    case "openai-embeddings":
      return `Model: ${config.model ?? "text-embedding-3-small"}`;
    case "http-request":
      return `${config.method ?? "GET"} ${config.url ?? "Not configured"}`;
    case "json-parse":
      return `Path: ${config.path ?? "root"}`;
    case "condition":
      return `if: ${config.humanCondition ?? config.operator ?? "Not set"}`;
    case "delay": {
      const d = config.duration ?? 1;
      const u = config.unit ?? (typeof d === "number" ? "ms" : "s");
      return `Wait ${d}${u}`;
    }
    case "loop":
      return `Loop: ${config.arrayKey ?? "Not set"}`;
    case "template": {
      const t = String(config.template ?? "").trim();
      return t ? (t.length > 70 ? t.slice(0, 70) + "…" : t) : "No template";
    }
    default:
      return "Not configured";
  }
}

type BaseNodeData = {
  specId: string;
  title?: string;
  label?: string;
  config?: any;
  status?: "idle" | "running" | "success" | "error";
  errorMessage?: string;
  executionTime?: number;
  tags?: string[];
};

function BaseNodeImpl(props: NodeProps<BaseNodeData>) {
  const { id, data, selected } = props;
  const spec = getNodeSpec(data?.specId);
  const registry = getNodeRegistryEntry(data?.specId ?? "");
  const edges = useStore((s) => s.edges);

  const nodeColor = registry?.color ?? "#8b5cf6";
  const label = data?.title ?? data?.label ?? registry?.label ?? spec?.label ?? "Node";
  const version = spec?.version ?? data?.config?.version ?? "1.0.0";
  const status = data?.status ?? "idle";
  const config = data?.config ?? {};
  const errorMessage = data?.errorMessage ?? "";
  const executionTime = data?.executionTime;
  const tags = data?.config?.tags ?? data?.tags;

  const previewText = useMemo(
    () => buildPreview(data?.specId ?? "", config, edges, id),
    [data?.specId, config, edges, id]
  );

  const ports = spec?.ports ?? [];
  const inputs = ports.filter((p) => p.kind === "input");
  const outputs = ports.filter((p) => p.kind === "output");

  const IconComponent = getIconComponent(registry?.icon ?? "MessageSquare");

  return (
    <div
      className="base-node"
      style={{
        width: 240,
        background: "#161616",
        border: `1px solid ${selected ? nodeColor : status === "error" ? "#ef444460" : "#2a2a2a"}`,
        borderRadius: 8,
        boxShadow: selected
          ? `0 0 0 1px ${nodeColor}33, 0 8px 32px rgba(0,0,0,0.65), 0 0 40px ${nodeColor}08`
          : "0 4px 20px rgba(0,0,0,0.55), 0 1px 4px rgba(0,0,0,0.4)",
        overflow: "visible",
        position: "relative",
        transition: "border-color 150ms, box-shadow 150ms",
        animation: "baseNodeMount 180ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      data-nodeid={id}
    >
      {/* Left accent bar */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: nodeColor,
          borderRadius: "8px 0 0 8px",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />

      {/* Error banner */}
      {status === "error" && (
        <div
          style={{
            background: "#1e0a0a",
            borderBottom: "1px solid #3a1515",
            padding: "5px 10px 5px 12px",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <AlertTriangle size={11} color="#ef4444" />
          <span style={{ fontSize: 10, color: "#ef4444" }}>
            {(errorMessage || "Error").slice(0, 70)}
          </span>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          height: 42,
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
            background: `${nodeColor}18`,
            border: `1px solid ${nodeColor}35`,
            borderRadius: 5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            overflow: "hidden",
            boxShadow: `0 0 12px ${nodeColor}15`,
          }}
        >
          {registry?.iconImage ? (
            <img
              src={registry.iconImage}
              alt=""
              style={{
                width: 14,
                height: 14,
                objectFit: "contain",
              }}
            />
          ) : (
            <IconComponent size={14} style={{ color: nodeColor }} />
          )}
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
          {label}
        </span>
        <span
          style={{
            fontSize: 9,
            color: "#333",
            background: "#121212",
            border: "1px solid #1e1e1e",
            borderRadius: 99,
            padding: "1px 5px",
            flexShrink: 0,
          }}
        >
          v{version}
        </span>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            flexShrink: 0,
            background:
              status === "idle"
                ? "#252525"
                : status === "running"
                  ? "#3b82f6"
                  : status === "success"
                    ? "#22c55e"
                    : "#ef4444",
            border: status === "idle" ? "1px solid #2e2e2e" : "none",
          }}
        />
      </div>

      {/* Body — min-height 0, no padding for handles */}
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
          {previewText}
        </div>
        {tags && Array.isArray(tags) && tags.length > 0 && (
          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 3 }}>
            {tags.map((tag: string, i: number) => (
              <span
                key={i}
                style={{
                  fontSize: 9,
                  color: `${nodeColor}bb`,
                  background: `${nodeColor}10`,
                  border: `1px solid ${nodeColor}20`,
                  borderRadius: 99,
                  padding: "1px 6px",
                  fontWeight: 500,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          height: 24,
          background: "#121212",
          borderTop: "1px solid #1c1c1c",
          borderRadius: "0 0 8px 8px",
          padding: "0 12px 0 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontFamily: "monospace", fontSize: 9, color: "#282828" }}>
          #{id.slice(0, 6)}
        </span>
        <span
          style={{
            fontSize: 9,
            color:
              status === "success"
                ? "#22c55e"
                : status === "error"
                  ? "#ef4444"
                  : status === "running"
                    ? "#3b82f6"
                    : "#282828",
          }}
        >
          {status === "success" && executionTime != null
            ? `✓ ${executionTime}ms`
            : status === "error"
              ? "✗ Error"
              : status === "running"
                ? "···"
                : "—"}
        </span>
      </div>

      {/* Handles — NO labels passed */}
      {inputs.map((p) => (
        <NodeHandle
          key={p.id}
          nodeId={id}
          id={p.id}
          type="target"
          position={Position.Left}
          nodeColor={nodeColor}
          isConnectable
        />
      ))}
      {outputs.map((p) => (
        <NodeHandle
          key={p.id}
          nodeId={id}
          id={p.id}
          type="source"
          position={Position.Right}
          nodeColor={nodeColor}
          isConnectable
        />
      ))}
    </div>
  );
}

export const BaseNode = memo(BaseNodeImpl);

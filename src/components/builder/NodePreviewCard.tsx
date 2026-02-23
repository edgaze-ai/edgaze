"use client";

import React from "react";
import type { NodeSpec } from "src/nodes/types";
import { getNodeRegistryEntry } from "src/nodes/NODE_REGISTRY";
import {
  ArrowRight,
  ArrowLeft,
  GitMerge,
  GitBranch,
  Timer,
  Repeat,
  MessageSquare,
  Braces,
  Image as ImageIcon,
  Globe,
  FileText,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; style?: any }>> = {
  ArrowRight,
  ArrowLeft,
  GitMerge,
  GitBranch,
  Timer,
  Repeat,
  MessageSquare,
  Braces,
  Image: ImageIcon,
  Globe,
  FileText,
};

function getIconComponent(iconName: string) {
  return ICON_MAP[iconName] ?? MessageSquare;
}

function getPreviewText(specId: string, spec: NodeSpec): string {
  const c = spec.defaultConfig ?? {};
  switch (specId) {
    case "input":
      return `Key: ${c.name ?? "Not set"}`;
    case "output":
      return `Format: ${c.format ?? "json"}`;
    case "merge":
      return "Merging inputs";
    case "openai-chat":
      return (c.prompt ?? "").trim() ? String(c.prompt).slice(0, 50) + "…" : "No prompt set";
    case "openai-image":
      return `Size: ${c.size ?? "1024x1024"} · ${c.n ?? 1} image(s)`;
    case "openai-embeddings":
      return `Model: ${c.model ?? "text-embedding-3-small"}`;
    case "http-request":
      return `${c.method ?? "GET"} ${c.url ?? "Not configured"}`;
    case "json-parse":
      return `Path: ${c.path ?? "root"}`;
    case "condition":
      return `if: ${c.operator ?? "Not set"}`;
    case "delay":
      return `Wait ${c.duration ?? 1}${c.unit ?? "s"}`;
    case "loop":
      return `Loop: ${c.arrayKey ?? "Not set"}`;
    case "template":
      return (c.template ?? "").trim() ? String(c.template).slice(0, 50) + "…" : "No template";
    default:
      return spec.summary ?? "Not configured";
  }
}

/**
 * Canvas-accurate node preview for Block Library.
 * Matches BaseNode / MergeNode layout exactly.
 */
export function NodePreviewCard({
  spec,
  onDragStart,
}: {
  spec: NodeSpec;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const registry = getNodeRegistryEntry(spec.id);
  const nodeColor = registry?.color ?? "#8b5cf6";
  const previewText = getPreviewText(spec.id, spec);
  const IconComponent = getIconComponent(registry?.icon ?? "MessageSquare");

  const cardWrapperStyle: React.CSSProperties = {
    width: 200,
    overflow: "hidden",
    flexShrink: 0,
  };

  if (spec.nodeType === "edgCondition") {
    const nodeColor = "#f59e0b";
    return (
      <div
        className="node-preview-card cursor-grab active:cursor-grabbing relative shrink-0"
        style={cardWrapperStyle}
        draggable
        onDragStart={onDragStart}
        title="Drag to canvas"
        role="button"
        tabIndex={0}
      >
        <div
          style={{
            pointerEvents: "none",
            overflow: "hidden",
            width: "100%",
            padding: "6px 12px",
          }}
        >
          <div
            style={{
              width: "100%",
              padding: "9px 11px",
              background: "#111111",
              border: "1px solid #1c1c1c",
              borderRadius: 7,
              overflow: "hidden",
              position: "relative",
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
              background: "linear-gradient(180deg, #f59e0b 0%, #ef4444 100%)",
              borderRadius: "8px 0 0 8px",
              zIndex: 2,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                background: "rgba(245,158,11,0.12)",
                border: "1px solid rgba(245,158,11,0.22)",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IconComponent size={12} style={{ color: nodeColor }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: "#c8c8c8", flex: 1 }}>Condition</span>
            <span style={{ fontSize: 9, color: "#333" }}>
              v{spec.version ?? "1.0.0"}
            </span>
          </div>
          <div style={{ marginTop: 5 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: nodeColor }}>IF</div>
            <div
              style={{
                fontSize: 11,
                color: "#505050",
                fontStyle: "italic",
                marginTop: 5,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {previewText}
            </div>
            <div style={{ height: 1, background: "#1e1e1e", margin: "4px 0" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
                <span style={{ fontSize: 8, fontWeight: 500, color: "#22c55e" }}>True →</span>
                <span style={{ fontSize: 8, color: "#444" }}>if passes</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#ef4444", flexShrink: 0 }} />
                <span style={{ fontSize: 8, fontWeight: 500, color: "#ef4444" }}>False →</span>
                <span style={{ fontSize: 8, color: "#444" }}>if fails</span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 6, display: "flex", alignItems: "center" }}>
            <span style={{ fontFamily: "monospace", fontSize: 9, color: "#3f3f46" }}>1 in · 2 out</span>
          </div>
          </div>
        </div>
      </div>
    );
  }

  if (spec.nodeType === "edgMerge") {
    return (
      <div
        className="node-preview-card cursor-grab active:cursor-grabbing shrink-0"
        style={cardWrapperStyle}
        draggable
        onDragStart={onDragStart}
        title="Drag to canvas"
        role="button"
        tabIndex={0}
      >
        <div
          style={{
            pointerEvents: "none",
            overflow: "hidden",
            width: "100%",
            padding: "6px 12px",
          }}
        >
          <div
            style={{
              width: "100%",
              padding: "9px 11px",
              background: "#111111",
              border: "1px solid #1c1c1c",
              borderRadius: 7,
              overflow: "hidden",
            }}
          >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 20,
                height: 20,
                background: `${nodeColor}15`,
                border: `1px solid ${nodeColor}28`,
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IconComponent size={12} style={{ color: nodeColor }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: "#c8c8c8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {spec.label}
            </span>
            <span style={{ fontSize: 9, color: "#333" }}>v{spec.version ?? "1.0.0"}</span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#505050",
              fontStyle: "italic",
              marginTop: 5,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {previewText}
          </div>
          <div style={{ marginTop: 6 }}>
            <span style={{ fontFamily: "monospace", fontSize: 9, color: "#3f3f46" }}>#preview</span>
          </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="node-preview-card cursor-grab active:cursor-grabbing relative shrink-0"
      style={cardWrapperStyle}
      draggable
      onDragStart={onDragStart}
      title="Drag to canvas"
      role="button"
      tabIndex={0}
    >
      <div
        style={{
          pointerEvents: "none",
          overflow: "hidden",
          width: "100%",
          padding: "6px 12px",
        }}
      >
        <div
          style={{
            width: "100%",
            padding: "9px 11px",
            background: "#111111",
            border: "1px solid #1c1c1c",
            borderRadius: 7,
            overflow: "hidden",
            position: "relative",
          }}
        >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 20,
              height: 20,
              background: `${nodeColor}15`,
              border: `1px solid ${nodeColor}28`,
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {registry?.iconImage ? (
              <img src={registry.iconImage} alt="" style={{ width: 12, height: 12, objectFit: "contain" }} />
            ) : (
              <IconComponent size={12} style={{ color: nodeColor }} />
            )}
          </div>
          <span style={{ fontSize: 12, fontWeight: 500, color: "#c8c8c8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {spec.label}
          </span>
          <span style={{ fontSize: 9, color: "#333" }}>v{spec.version ?? "1.0.0"}</span>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#252525", flexShrink: 0 }} />
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#505050",
            fontStyle: "italic",
            marginTop: 5,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {previewText}
        </div>
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "monospace", fontSize: 9, color: "#3f3f46" }}>#preview</span>
          <span style={{ fontSize: 9, color: "#3f3f46" }}>—</span>
        </div>
        </div>
      </div>
    </div>
  );
}

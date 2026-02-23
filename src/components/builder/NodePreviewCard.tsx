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

  if (spec.nodeType === "edgCondition") {
    const nodeColor = "#f59e0b";
    return (
      <div
        className="node-preview-card cursor-grab active:cursor-grabbing relative shrink-0"
        style={{ width: 200 }}
        draggable
        onDragStart={onDragStart}
        title="Drag to canvas"
        role="button"
        tabIndex={0}
      >
        <div
          style={{
            width: 200,
            background: "#1a1a1c",
            border: "1px solid #2a2a2a",
            borderRadius: 8,
            boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
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
              height: 30,
              background: "#1e1e1e",
              borderBottom: "1px solid #242424",
              borderRadius: "8px 8px 0 0",
              padding: "0 8px 0 10px",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                background: "rgba(245,158,11,0.12)",
                border: "1px solid rgba(245,158,11,0.22)",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IconComponent size={10} style={{ color: nodeColor }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 500, color: "#e2e2e2", flex: 1 }}>Condition</span>
            <span style={{ fontSize: 8, color: "#333", background: "#111", border: "1px solid #1e1e1e", borderRadius: 999, padding: "1px 4px" }}>
              v{spec.version ?? "1.0.0"}
            </span>
          </div>
          <div style={{ padding: "6px 8px 6px 10px", background: "#1a1a1c" }}>
            <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.06em", color: nodeColor }}>IF</div>
            <div style={{ fontSize: 10, color: "#71717a", marginTop: 1 }}>{previewText}</div>
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
          <div
            style={{
              height: 18,
              background: "#111",
              borderTop: "1px solid #1c1c1c",
              borderRadius: "0 0 8px 8px",
              padding: "0 8px 0 10px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span style={{ fontFamily: "monospace", fontSize: 8, color: "#3f3f46" }}>1 in · 2 out</span>
          </div>
        </div>
      </div>
    );
  }

  if (spec.nodeType === "edgMerge") {
    return (
      <div
        className="node-preview-card cursor-grab active:cursor-grabbing"
        style={{ width: 220 }}
        draggable
        onDragStart={onDragStart}
        title="Drag to canvas"
        role="button"
        tabIndex={0}
      >
        <div
          style={{
            width: 220,
            background: "#18181b",
            border: "1px solid #27272a",
            borderRadius: 8,
            boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: 36,
              background: "#1c1c1c",
              borderBottom: "1px solid #222",
              borderRadius: "8px 8px 0 0",
              padding: "0 10px 0 12px",
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                background: `${nodeColor}15`,
                border: `1px solid ${nodeColor}28`,
                borderRadius: 5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IconComponent size={12} style={{ color: nodeColor }} />
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#e4e4e7",
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {spec.label}
            </span>
            <span style={{ fontSize: 9, color: "#333", background: "#111", border: "1px solid #1e1e1e", borderRadius: 99, padding: "1px 5px" }}>
              v{spec.version ?? "1.0.0"}
            </span>
          </div>
          <div style={{ padding: "8px 10px 8px 12px", background: "#18181b", minHeight: 0 }}>
            <div
              style={{
                fontSize: 11,
                color: "#71717a",
                fontStyle: "italic",
                lineHeight: 1.45,
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
          </div>
          <div
            style={{
              height: 22,
              background: "#111",
              borderTop: "1px solid #27272a",
              borderRadius: "0 0 8px 8px",
              padding: "0 10px 0 12px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span style={{ fontFamily: "monospace", fontSize: 9, color: "#3f3f46" }}>#preview</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="node-preview-card cursor-grab active:cursor-grabbing relative"
      style={{ width: 220 }}
      draggable
      onDragStart={onDragStart}
      title="Drag to canvas"
      role="button"
      tabIndex={0}
    >
      <div
        style={{
          width: 220,
          background: "#18181b",
          border: "1px solid #27272a",
          borderRadius: 8,
          boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            height: 36,
            background: "#1f1f23",
            borderBottom: "1px solid #27272a",
            borderRadius: "8px 8px 0 0",
            padding: "0 10px 0 12px",
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              background: `${nodeColor}15`,
              border: `1px solid ${nodeColor}28`,
              borderRadius: 5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {registry?.iconImage ? (
              <img
                src={registry.iconImage}
                alt=""
                style={{ width: 14, height: 14, objectFit: "contain" }}
              />
            ) : (
              <IconComponent size={12} style={{ color: nodeColor }} />
            )}
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "#e4e4e7",
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {spec.label}
          </span>
          <span
            style={{
              fontSize: 9,
              color: "#333",
              background: "#111",
              border: "1px solid #1e1e1e",
              borderRadius: 99,
              padding: "1px 5px",
              flexShrink: 0,
            }}
          >
            v{spec.version ?? "1.0.0"}
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
        <div style={{ padding: "8px 10px 8px 12px", background: "#18181b", minHeight: 0 }}>
          <div
            style={{
              fontSize: 11,
              color: "#71717a",
              fontStyle: "italic",
              lineHeight: 1.45,
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
        </div>
        <div
          style={{
            height: 22,
            background: "#111",
            borderTop: "1px solid #27272a",
            borderRadius: "0 0 8px 8px",
            padding: "0 10px 0 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontFamily: "monospace", fontSize: 9, color: "#3f3f46" }}>#preview</span>
          <span style={{ fontSize: 9, color: "#3f3f46" }}>—</span>
        </div>
      </div>
    </div>
  );
}

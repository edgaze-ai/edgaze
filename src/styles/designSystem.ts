// src/styles/designSystem.ts
// Design tokens — use these EVERYWHERE. No hardcoded colors elsewhere.

export const DS = {
  // ═══════════════════════════════════════
  // COLORS
  // ═══════════════════════════════════════
  background: {
    app: "#0a0a0a",
    canvas: "#0d0d0d",
    surface: "#111111",
    elevated: "#161616",
    overlay: "#1a1a1a",
    border: "#222222",
    borderSubtle: "#1a1a1a",
    borderHover: "#333333",
  },

  text: {
    primary: "#f0f0f0",
    secondary: "#888888",
    tertiary: "#555555",
    accent: "#ffffff",
  },

  accent: {
    io: "#3b82f6",
    ai: "#8b5cf6",
    logic: "#f59e0b",
    utility: "#14b8a6",
    // Brand accents — cyan and pink (keep these)
    cyan: "#22d3ee",
    pink: "#ec4899",
    fuchsia: "#e879f9",
  },

  status: {
    success: "#22c55e",
    error: "#ef4444",
    warning: "#f59e0b",
    running: "#3b82f6",
    idle: "#333333",
  },

  // ═══════════════════════════════════════
  // TYPOGRAPHY
  // ═══════════════════════════════════════
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
  fontMono: "JetBrains Mono, Fira Code, monospace",

  fontSizes: {
    xs: "10px",
    sm: "11px",
    base: "12px",
    md: "13px",
    lg: "14px",
    xl: "16px",
  },

  // ═══════════════════════════════════════
  // SPACING (4px base unit)
  // ═══════════════════════════════════════
  spacing: {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
  },

  // ═══════════════════════════════════════
  // RADIUS
  // ═══════════════════════════════════════
  radius: {
    sm: "6px",
    md: "8px",
    lg: "10px",
    xl: "12px",
  },

  // ═══════════════════════════════════════
  // SHADOWS
  // ═══════════════════════════════════════
  shadows: {
    node: "0 4px 32px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)",
    nodeSelected: "0 8px 40px rgba(0,0,0,0.6)",
    panel: "0 0 0 1px #1a1a1a, 0 8px 32px rgba(0,0,0,0.4)",
    tooltip: "0 4px 16px rgba(0,0,0,0.5)",
  },

  // ═══════════════════════════════════════
  // TRANSITIONS
  // ═══════════════════════════════════════
  transition: "all 120ms ease",
  transitionSlow: "all 180ms ease-out",
} as const;

export type DesignSystem = typeof DS;

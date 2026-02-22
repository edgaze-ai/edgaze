/**
 * Shared styles for node components (error banner, footer, etc.)
 */
export const NODE_STYLES = {
  errorBanner: {
    maxChars: 120,
    background: "rgba(220, 38, 38, 0.15)",
    borderBottom: "1px solid rgba(220, 38, 38, 0.4)",
    fontSize: "11px",
    color: "#fca5a5",
    padding: "6px 10px",
  },
  status: {
    running: { bg: "#3b82f6" },
    success: { bg: "#22c55e" },
    error: { bg: "#ef4444" },
  },
  footer: {
    height: "28px",
    background: "rgba(0,0,0,0.25)",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    idColor: "rgba(255,255,255,0.5)",
    padding: "0 10px",
    idFontSize: "10px",
    resultFontSize: "11px",
  },
  wrapper: {
    borderRadius: "12px",
  },
} as const;

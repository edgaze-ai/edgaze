/**
 * Design tokens for the Edgaze builder UI.
 * Used for consistent theming across builder components.
 */
export const tokens = {
  bg: {
    base: "#0d0d0d",
    panel: "#141414",
    elevated: "#1a1a1a",
    surface: "#171717",
  },
  text: {
    primary: "#e5e5e5",
    secondary: "#a3a3a3",
    tertiary: "#737373",
  },
  border: {
    default: "#262626",
    subtle: "#1e1e1e",
    focus: "#22d3ee",
  },
  gradient: {
    aiButton: "linear-gradient(135deg, rgba(34,211,238,0.15) 0%, rgba(139,92,246,0.15) 100%)",
  },
} as const;

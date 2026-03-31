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
    focus: "#78E9FF",
  },
  gradient: {
    edgaze:
      "linear-gradient(90deg, rgba(120,233,255,1) 0%, rgba(182,140,255,1) 54%, rgba(255,109,178,1) 100%)",
    edgazeSoft:
      "linear-gradient(135deg, rgba(120,233,255,0.18) 0%, rgba(182,140,255,0.14) 48%, rgba(255,109,178,0.14) 100%)",
    aiButton:
      "linear-gradient(135deg, rgba(120,233,255,0.16) 0%, rgba(182,140,255,0.12) 55%, rgba(255,109,178,0.12) 100%)",
  },
  motion: {
    fast: "150ms cubic-bezier(0.2, 0.9, 0.2, 1)",
    standard: "220ms cubic-bezier(0.2, 0.9, 0.2, 1)",
    slow: "340ms cubic-bezier(0.2, 0.9, 0.2, 1)",
  },
} as const;

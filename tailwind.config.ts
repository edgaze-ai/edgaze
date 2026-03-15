import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        edge: {
          bg: "#0a0a0a",
          fg: "#ffffff",
          border: "rgba(255,255,255,0.12)",
        },
        onboarding: {
          bg: "#0A0A0B",
          surface: "#111113",
          border: "rgba(255,255,255,0.06)",
          teal: "#00E5CC",
          "teal-glow": "rgba(0,229,204,0.3)",
        },
      },
      boxShadow: {
        glow: "0 10px 30px rgba(34,211,238,0.15)",
        premium: "0 0 0 1px rgba(255,255,255,0.04), 0 24px 48px rgba(0,0,0,0.4)",
        "teal-glow": "0 0 20px rgba(0,229,204,0.3)",
      },
      fontFamily: {
        instrument: ["var(--font-instrument-serif)", "serif"],
        "dm-sans": ["var(--font-dm-sans)", "sans-serif"],
        jetbrains: ["var(--font-jetbrains-mono)", "monospace"],
      },
      animation: {
        breathing: "breathing 4s ease-in-out infinite",
        shimmer: "shimmer 3s ease-in-out infinite",
        "payout-shimmer": "payout-shimmer 8s ease-in-out infinite alternate",
        "payout-pulse": "payout-pulse 6s ease-in-out infinite",
      },
      keyframes: {
        breathing: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.15)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        "payout-shimmer": {
          "0%": { opacity: "0.2" },
          "100%": { opacity: "0.35" },
        },
        "payout-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.6" },
        },
      },
    },
  },
  plugins: [],
};
export default config;

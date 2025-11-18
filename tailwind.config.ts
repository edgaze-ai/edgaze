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
          border: "rgba(255,255,255,0.12)"
        }
      },
      boxShadow: {
        glow: "0 10px 30px rgba(34,211,238,0.15)"
      }
    }
  },
  plugins: []
};
export default config;

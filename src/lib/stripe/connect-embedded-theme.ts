import type { AppearanceOptions, CssFontSource } from "@stripe/connect-js/types/shared";

const interFont: CssFontSource = {
  cssSrc: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
};

/** Connect.js appearance + Inter — used by earnings dashboard and related embedded UIs. */
export const connectEmbeddedAppearance: AppearanceOptions = {
  variables: {
    colorText: "#f3f4f6",
    colorBackground: "#14171D",
    colorPrimary: "#22d3ee",
    colorDanger: "#f87171",
    borderRadius: "12px",
    fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
  },
};

export const connectEmbeddedFonts: CssFontSource[] = [interFont];

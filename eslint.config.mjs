// eslint.config.mjs
import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,

  {
    rules: {
      "@next/next/no-img-element": "off",
      "@next/next/no-html-link-for-pages": "off",

      // beta: keep CI green
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  {
    ignores: [
      ".next/**",
      ".next-dev/**",
      ".next 2/**",
      "dist/**",
      "build/**",
      "out/**",
      "node_modules/**",
      "var/**",
      // Local-only Next dev artifacts that may end up under the workspace
      // (custom distDir history + iCloud-resolved `/private/var/folders/...`).
      "tmp/**",
      "private/**",
      ".claude/**",
      "public/pdf.worker.min.mjs",
    ],
  },
];

export default config;

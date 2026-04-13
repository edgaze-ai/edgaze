// eslint.config.js
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
      ".next 2/**",
      "dist/**",
      "build/**",
      "out/**",
      "node_modules/**",
      ".claude/**",
      "public/pdf.worker.min.mjs",
    ],
  },
];

export default config;

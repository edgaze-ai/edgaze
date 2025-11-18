// Flat config
import next from "eslint-config-next";

export default [
  ...next,
  {
    rules: {
      "@next/next/no-img-element": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }]
    },
    ignores: ["**/dist/**", "**/.next/**"]
  }
];

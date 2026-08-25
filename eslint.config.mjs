import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Electron main/preload process: plain CommonJS Node.js, not part of the
    // Next.js app (already excluded from tsconfig.json for the same reason).
    "electron/**",
    // Design reference mockups (Claude Design canvas export) — not app source.
    "Réponses formulaire écrans/**",
  ]),
]);

export default eslintConfig;

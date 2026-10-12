import { defineConfig, globalIgnores } from "eslint/config";
import nextPlugin from "eslint-config-next";

const nextConfig = Array.isArray(nextPlugin) ? nextPlugin : [nextPlugin];

export default defineConfig([
  ...nextConfig,
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    "skills/**",
    "docs/**",
    "prisma/seed.ts",
  ]),
]);

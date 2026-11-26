import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(".") } },
  // Components are rendered in tests with react-dom/server; use the same JSX runtime as Next.
  esbuild: { jsx: "automatic" },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});

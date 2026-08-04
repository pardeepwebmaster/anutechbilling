import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Vitest = unit tests only (pure logic under src/). Playwright E2E specs live in
// e2e/ and run via `npm run test:e2e` — they MUST be excluded here, otherwise
// `vitest run` tries to execute Playwright's test.describe() and fails.
export default defineConfig({
  // Mirror the tsconfig `@/*` → `src/*` alias so tests can import modules that
  // use the `@` alias at runtime (not just as type-only imports).
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "e2e", ".next", "dist", "playwright-report", "test-results"],
  },
});

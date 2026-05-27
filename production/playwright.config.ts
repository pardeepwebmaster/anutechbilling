/**
 * Playwright config — ResellerOS E2E tests.
 *
 * Layered safety net for our multi-tenant code:
 *   1. critical-path tests   — happy-path lead → quote → payment → invoice
 *   2. RLS cross-tenant tests — VERIFY tenant A cannot read tenant B's data
 *   3. role-permission tests  — owner/manager/sales scoped routes work
 *
 * Tests live in `e2e/` and assume:
 *   - A locally-running Next dev server (`npm run dev` on :3000) OR
 *     the `webServer` block below auto-starts one
 *   - Supabase with seeded test-users (run `supabase/seed/test-users.sql`)
 *
 * Run:
 *   npm run test:e2e            # headless
 *   npm run test:e2e:ui         # interactive UI mode
 *   npx playwright test --debug # step-through debugger
 *
 * CI:
 *   GitHub Actions runs this on every PR (planned in .github/workflows/ci.yml).
 *   Uses BASE_URL env from secrets pointing at staging Cloud Run URL.
 */
import { defineConfig, devices } from "@playwright/test";

// Resolve base URL from env so the same suite runs against local / staging / prod.
// Default: local dev server at port 3000.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",

  // ── Failure tolerance ──────────────────────────────────────
  // Retry once on CI (flaky network); zero retries locally (fail fast).
  retries: process.env.CI ? 1 : 0,
  // Fail the build if test.only is left in code.
  forbidOnly: !!process.env.CI,
  // Total timeout per test — 30s is generous; tests that need more are buggy.
  timeout: 30_000,
  // Parallel workers — defaults to half of available CPUs. CI uses 1 to
  // avoid contention with Supabase rate limits on shared test data.
  workers: process.env.CI ? 1 : undefined,

  // ── Reporting ──────────────────────────────────────────────
  // HTML report saved to playwright-report/ — view via `npx playwright show-report`.
  // List reporter to stdout for CI log readability.
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],

  // ── Shared use options ─────────────────────────────────────
  use: {
    baseURL: BASE_URL,
    // Capture artifacts on first failure to debug regressions fast.
    trace:      "retain-on-failure",
    screenshot: "only-on-failure",
    video:      "retain-on-failure",
    // Default action timeout — element interactions wait up to 10s.
    actionTimeout: 10_000,
  },

  // ── Browser projects ───────────────────────────────────────
  // Desktop Chrome covers ~95% of our Indian admin users (browser stats per
  // StatCounter India 2026). Mobile Safari covers iOS reps; Mobile Chrome
  // covers the dominant Android cohort. Add Firefox if customer complaints
  // come in — for now it's wasted CI time.
  projects: [
    {
      name: "chromium",
      use:  { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use:  { ...devices["Pixel 7"] },
    },
  ],

  // ── Auto-start dev server in local runs ───────────────────
  // When PLAYWRIGHT_BASE_URL points at staging/prod we skip this block.
  // Locally Playwright spins up `npm run dev` and waits for :3000 to respond.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url:     "http://localhost:3000",
        // Reuse the already-running dev server in dev cycles (faster).
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});

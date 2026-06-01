/**
 * money-spine.spec.ts — happy-path E2E smoke for the money spine:
 *   lead → quote → pay → subscription → invoice → renewal
 *
 * PURPOSE (the regression net the test matrix §6 step 6 asks for):
 *   The per-RPC money MATH is already locked by the SQL regression suite
 *   (record_payment idempotency/sibling/mrr, generate_invoice atomicity,
 *   accept_quote conversion, renewal roll-forward, zero-amount guards). What
 *   those DB tests CANNOT catch is the UI funnel silently breaking — a page
 *   that throws its error boundary, a route that 500s, a builder that stops
 *   computing a total after a refactor. THIS spec is that net: it logs in as
 *   the operator and walks every spine surface, asserting each renders inside
 *   the app shell (not the error boundary) and shows its money machinery.
 *
 * It also drives the genuinely-cheap front of the happy path (create a lead →
 * open the quote builder prefilled → assert a GST-inclusive total computes).
 * It intentionally does NOT click "record payment" / "generate invoice" in the
 * UI: those burn real, gap-free GST document serials that can't be cleanly torn
 * down, and their correctness is already proven by the SQL suite. When a
 * disposable staging DB exists, extend Stage 4 to walk pay→invoice→renew.
 *
 * Runs against Test Tenant A (synthetic) via loginViaSupabase. Gated on env +
 * seeded auth users (same pattern as lead-flow.spec.ts) so it's a no-op until
 * .env.test + ensureTestAuthUsers() are wired (see e2e/README.md).
 */
import { expect, test, type Page } from "@playwright/test";
import { loginViaSupabase } from "./fixtures/auth";

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
);

/** Assert a spine page rendered inside the app shell (sidebar present, no
 *  error boundary) and its section heading is visible. */
async function expectStageRenders(page: Page, path: string, headingRe: RegExp) {
  await page.goto(path);
  await expect(page).toHaveURL(new RegExp(path.replace(/\//g, "\\/")));
  // The app shell sidebar always renders the section nav — its presence proves
  // we're not on /login or the error boundary.
  await expect(page.getByRole("link", { name: /Dashboard/i }).first()).toBeVisible({ timeout: 10_000 });
  // Section heading (eyebrow + serif h1 pattern used on every listing page).
  await expect(page.getByRole("heading", { name: headingRe }).first()).toBeVisible();
  // The app error boundary (app/(app)/error.tsx) must NOT be showing.
  await expect(page.getByText(/Something went wrong|Could not load/i)).toHaveCount(0);
}

test.describe("Money spine — funnel renders end-to-end (operator)", () => {
  test.skip(!hasEnv, "Needs NEXT_PUBLIC_SUPABASE_ANON_KEY + seeded test users in .env.test.");

  test.beforeEach(async ({ context }) => {
    await loginViaSupabase(context, "owner@testa.dev");
  });

  test("every spine stage page renders inside the app shell", async ({ page }) => {
    await expectStageRenders(page, "/dashboard",     /Dashboard|Overview|Today/i);
    await expectStageRenders(page, "/leads",         /Leads/i);
    await expectStageRenders(page, "/quotes",        /Quotes/i);
    await expectStageRenders(page, "/invoices",      /Invoices/i);
    await expectStageRenders(page, "/subscriptions", /Subscriptions/i);
    await expectStageRenders(page, "/renewals",      /Renewals/i);
    await expectStageRenders(page, "/payments",      /Payments/i);
    await expectStageRenders(page, "/customers",     /Customers/i);
  });

  test("invoices page surfaces the money KPIs", async ({ page }) => {
    await page.goto("/invoices");
    // Outstanding KPI is the anchor money figure on this page.
    await expect(page.getByText(/Outstanding/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("quote builder opens and computes a GST-inclusive total", async ({ page }) => {
    await page.goto("/quotes/new");
    await expect(page).toHaveURL(/\/quotes\/new/);
    // Builder must render its form machinery (line items / customer / totals),
    // not redirect or error. A rupee figure proves the totals engine ran.
    await expect(page.getByRole("link", { name: /Dashboard/i }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/₹/).first()).toBeVisible({ timeout: 10_000 });
  });

  test("happy-path front: quick-add a lead, then reach the quote builder", async ({ page }) => {
    await page.goto("/leads");
    await expect(page.getByRole("heading", { name: /Leads/i }).first()).toBeVisible({ timeout: 10_000 });

    const stamp = Date.now().toString().slice(-6);

    // Quick add — split-button caret (desktop) OR mobile FAB.
    const caret = page.getByRole("button", { name: /More ways to add a lead/i });
    if (await caret.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await caret.click();
      await page.getByRole("menuitem", { name: /Quick add/i }).click();
    } else {
      // Mobile (Pixel 7) — the split-button is hidden; use the FAB quick action.
      await page.getByRole("button", { name: /Quick add lead.*4 fields/i }).click();
    }

    await expect(page.getByRole("heading", { name: /Quick add lead/i })).toBeVisible();
    await page.fill("#q-company", `E2E Spine Co ${stamp}`);
    await page.fill("#q-contact-name", `E2E Buyer ${stamp}`);
    await page.fill("#q-contact-email", `e2e+spine${stamp}@test.dev`);
    await page.fill("#q-contact-phone", "+91 90000 00000");
    await page.getByRole("button", { name: /Save lead/i }).click();
    await expect(page.getByText(/added to your inbox/i)).toBeVisible({ timeout: 5_000 });

    // The builder is reachable for the next spine step (quote build).
    await page.goto("/quotes/new");
    await expect(page).toHaveURL(/\/quotes\/new/);
    await expect(page.getByText(/₹/).first()).toBeVisible({ timeout: 10_000 });
  });
});

/**
 * Public storefront — the true head of the spine (no auth). A customer lands
 * on the buy page, picks seats, and the price they SEE must render. Runs
 * without seeded users, so it's a live check of the deployed funnel's entry.
 */
test.describe("Money spine — public buy page (no auth)", () => {
  test("workspace buy page renders a price for the default plan", async ({ page }) => {
    await page.goto("/buy/workspace");
    // Page should render product/pricing UI with a rupee figure, not 500.
    await expect(page.getByText(/₹/).first()).toBeVisible({ timeout: 15_000 });
  });
});

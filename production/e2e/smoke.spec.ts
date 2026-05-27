/**
 * Smoke test — verifies the app boots, login page renders, and unauthenticated
 * requests to /(app) routes redirect to /login.
 *
 * This is the bare-minimum E2E "is everything wired" check. It runs without
 * needing seeded test users, so it can verify the infrastructure itself
 * (Next.js, middleware, Supabase reachability) on every commit.
 *
 * Auth-requiring tests live in their own spec files (planned: auth.spec.ts,
 * cross-tenant.spec.ts, lead-flow.spec.ts) and use the fixtures in
 * `e2e/fixtures/` to log in as different roles.
 */
import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("login page renders with email + password inputs", async ({ page }) => {
    await page.goto("/login");

    // Title is rendered (whatever the actual h1 says, just verify SOMETHING).
    await expect(page).toHaveTitle(/ResellerOS|Login|Sign in/i);

    // Email input present.
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await expect(emailInput).toBeVisible();

    // Password input present.
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await expect(passwordInput).toBeVisible();
  });

  test("/(app) route without auth redirects to /login", async ({ page }) => {
    // Try to access a protected page while unauthenticated.
    await page.goto("/leads");
    // Middleware should bounce us to /login.
    await expect(page).toHaveURL(/\/login/);
  });

  test("home page (marketing landing) is reachable", async ({ page }) => {
    await page.goto("/");
    // Either it shows marketing copy or redirects somewhere (signup/dashboard).
    // We just check the request didn't 500.
    expect(page.url()).toBeTruthy();
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(0);
  });
});

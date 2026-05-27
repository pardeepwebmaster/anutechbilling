/**
 * auth.ts — Playwright login helpers for the test fixture users.
 *
 * Two flavors:
 *
 *   loginAs(page, email)
 *     UI-based login — fills the actual form. Slow (~2s) but exercises
 *     the auth code path end-to-end. Use sparingly in tests that
 *     specifically verify the login flow.
 *
 *   loginViaSupabase(context, email)
 *     Programmatic login — calls Supabase auth.signInWithPassword
 *     server-side, then writes the resulting session cookies into the
 *     browser context. Fast (~200ms), perfect for tests where login is
 *     setup, not the subject.
 *
 * Both helpers return the test user fixture for downstream assertions.
 */
import type { Page, BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { getTestUser, type TestUserFixture } from "./seed-auth";

// ── Env wiring ─────────────────────────────────────────────
// Tests need to know how to reach Supabase. Pull from env (set in
// `.env.test`) — same vars the app uses in production. Falls back to
// process.env so node -r dotenv/config keeps working.
const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://ontpnqjoysjgrlsukecm.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

/**
 * Slow path — log in by filling the actual login form. Useful for tests
 * that verify the login UI itself.
 */
export async function loginAs(page: Page, email: string): Promise<TestUserFixture> {
  const user = getTestUser(email);
  await page.goto("/login");
  await page.fill('input[type="email"], input[name="email"]', user.email);
  await page.fill('input[type="password"], input[name="password"]', user.password);
  // Submit — handle both <button type="submit"> and <input type="submit">.
  await page.locator('button[type="submit"], input[type="submit"]').first().click();
  // Wait for redirect to a /(app) route. ROLE_HOME maps:
  //   owner/manager → /dashboard
  //   sales         → /leads
  const expectedHome = user.role === "sales" ? "/leads" : "/dashboard";
  await page.waitForURL(new RegExp(expectedHome), { timeout: 10_000 });
  return user;
}

/**
 * Fast path — log in via Supabase JS client, then write the session
 * cookies into the Playwright browser context. Test then navigates
 * directly to any /(app) route without going through the login form.
 *
 * Implementation note:
 *   The app's @supabase/ssr cookies are httpOnly + secure. Playwright's
 *   `context.addCookies` writes them with the same flags. The middleware
 *   reads these on first request and refreshes the session.
 */
export async function loginViaSupabase(
  context: BrowserContext,
  email: string,
): Promise<TestUserFixture> {
  if (!SUPABASE_ANON_KEY) {
    throw new Error(
      "loginViaSupabase needs NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY) " +
      "in env. Set it in .env.test.",
    );
  }
  const user = getTestUser(email);

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await sb.auth.signInWithPassword({
    email:    user.email,
    password: user.password,
  });
  if (error || !data.session) {
    throw new Error(`loginViaSupabase failed for ${email}: ${error?.message ?? "no session"}`);
  }

  // Supabase stores session in localStorage by default. For SSR cookie auth
  // we need to set the cookies that @supabase/ssr expects. The cookie name
  // is sb-<project-ref>-auth-token. Project ref is the host's first label.
  const projectRef = new URL(SUPABASE_URL).host.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;

  // The session is a JSON-serialized object base64-encoded in the cookie.
  // Match the format @supabase/ssr writes.
  const cookieValue = encodeURIComponent(JSON.stringify([
    data.session.access_token,
    data.session.refresh_token,
    null,
    null,
    null,
  ]));

  await context.addCookies([
    {
      name:     cookieName,
      value:    cookieValue,
      domain:   "localhost",  // override per-env if hitting staging
      path:     "/",
      httpOnly: false,         // ssr cookies allow JS read in our setup
      secure:   false,
      sameSite: "Lax",
    },
  ]);

  return user;
}

/**
 * Get a Supabase client authenticated AS the given test user. Useful for
 * RLS verification tests that need to make direct database calls (not
 * through the Next.js app) to confirm row-level isolation.
 *
 * Example:
 *   const sbA = await getAuthenticatedClient("owner@testa.dev");
 *   const { data } = await sbA.from("leads").select("*").eq("tenant_id", TENANT_B_ID);
 *   expect(data).toEqual([]);  // RLS blocked cross-tenant read
 */
export async function getAuthenticatedClient(email: string) {
  if (!SUPABASE_ANON_KEY) {
    throw new Error("getAuthenticatedClient needs NEXT_PUBLIC_SUPABASE_ANON_KEY in env.");
  }
  const user = getTestUser(email);
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await sb.auth.signInWithPassword({
    email:    user.email,
    password: user.password,
  });
  if (error) {
    throw new Error(`getAuthenticatedClient signInWithPassword failed: ${error.message}`);
  }
  return sb;
}

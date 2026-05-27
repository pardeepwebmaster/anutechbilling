/**
 * seed-auth.ts — programmatically create / verify Supabase auth.users rows
 * for the test fixtures.
 *
 * Why a separate file from `supabase/seed/test-users.sql`?
 *   - SQL inserts can't touch auth.users (Supabase auth schema is admin-only).
 *   - Auth user creation needs the service-role key + Admin API.
 *   - Linking auth.users.id ↔ public.users.id needs an UPDATE after creation.
 *
 * This module is run once before the Playwright suite via a global setup
 * step (see `playwright.config.ts.globalSetup` in a future PR).
 *
 * Idempotency:
 *   - If the auth user already exists with the expected email, we no-op.
 *   - We never DELETE auth users — only create if missing.
 *
 * Security:
 *   - Uses SUPABASE_SERVICE_ROLE_KEY which MUST come from a .env.test file
 *     (gitignored) — never hardcoded.
 *   - Test passwords are weak by design ("test-password-1234") because they
 *     only protect synthetic tenants. NEVER reuse on real accounts.
 *
 * ⚠️  Wire-up TODO:
 *   - This file is the spec; the implementation calls Supabase Admin API
 *     which needs the service key. Hook it up in `playwright.config.ts`
 *     `globalSetup` once we have a .env.test with the staging service key.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Test user fixture — matches IDs seeded in test-users.sql */
export interface TestUserFixture {
  id:       string;
  email:    string;
  password: string;
  fullName: string;
  role:     "owner" | "manager" | "sales";
  tenantId: string;
}

// ── Canonical fixture roster ───────────────────────────────
// MUST match the IDs in supabase/seed/test-users.sql exactly.
// If you change one, change the other.
export const TENANT_A_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
export const TENANT_B_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

export const TEST_USERS: TestUserFixture[] = [
  // ── Tenant A ───────────────────────────────────────────────
  {
    id:       "11111111-aaaa-1111-aaaa-111111111111",
    email:    "owner@testa.dev",
    password: "test-password-1234",
    fullName: "Owner A",
    role:     "owner",
    tenantId: TENANT_A_ID,
  },
  {
    id:       "22222222-aaaa-2222-aaaa-222222222222",
    email:    "manager@testa.dev",
    password: "test-password-1234",
    fullName: "Manager A",
    role:     "manager",
    tenantId: TENANT_A_ID,
  },
  {
    id:       "33333333-aaaa-3333-aaaa-333333333333",
    email:    "sales@testa.dev",
    password: "test-password-1234",
    fullName: "Sales A",
    role:     "sales",
    tenantId: TENANT_A_ID,
  },
  // ── Tenant B ───────────────────────────────────────────────
  {
    id:       "11111111-bbbb-1111-bbbb-111111111111",
    email:    "owner@testb.dev",
    password: "test-password-1234",
    fullName: "Owner B",
    role:     "owner",
    tenantId: TENANT_B_ID,
  },
  {
    id:       "33333333-bbbb-3333-bbbb-333333333333",
    email:    "sales@testb.dev",
    password: "test-password-1234",
    fullName: "Sales B",
    role:     "sales",
    tenantId: TENANT_B_ID,
  },
];

/** Helper to grab a user by email (used by tests for login). */
export function getTestUser(email: string): TestUserFixture {
  const u = TEST_USERS.find((x) => x.email === email);
  if (!u) throw new Error(`Test user not found: ${email}`);
  return u;
}

/**
 * Ensure all test users exist in auth.users with the correct IDs.
 * Idempotent — creates missing users, leaves existing ones alone.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY env var (set in .env.test).
 */
export async function ensureTestAuthUsers(opts?: {
  supabaseUrl?:  string;
  serviceRoleKey?: string;
}): Promise<{ created: number; existed: number }> {
  const supabaseUrl    = opts?.supabaseUrl    ?? process.env.SUPABASE_URL              ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = opts?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "ensureTestAuthUsers requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. " +
      "Set these in .env.test (gitignored).",
    );
  }

  const admin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let created = 0;
  let existed = 0;
  for (const u of TEST_USERS) {
    // Check existence by listing users and matching email — cheap enough at our scale.
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users?.find((x) => x.email === u.email);
    if (existing) { existed++; continue; }
    const { error } = await admin.auth.admin.createUser({
      id:            u.id,
      email:         u.email,
      password:      u.password,
      email_confirm: true,
      user_metadata: { full_name: u.fullName },
    });
    if (error) {
      throw new Error(`Failed to create test user ${u.email}: ${error.message}`);
    }
    created++;
  }
  return { created, existed };
}

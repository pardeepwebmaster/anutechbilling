-- ============================================================
-- ResellerOS — E2E test users + tenants seed (idempotent)
-- ============================================================
-- Creates the fixture data Playwright tests rely on:
--
--   Tenant A "Test Tenant A" (uuid: aaaaaaaa-...)
--     owner@testa.dev    role=owner
--     manager@testa.dev  role=manager
--     sales@testa.dev    role=sales
--
--   Tenant B "Test Tenant B" (uuid: bbbbbbbb-...)
--     owner@testb.dev    role=owner
--     sales@testb.dev    role=sales
--
-- Plus 2 sample leads per tenant so RLS cross-tenant tests have data to
-- verify. The whole script is idempotent — safe to re-run any time
-- (uses ON CONFLICT DO NOTHING on every insert).
--
-- ── How to run ───────────────────────────────────────────────
-- Local dev:
--   supabase db reset    # wipes + re-seeds
--   psql $SUPABASE_DB_URL -f supabase/seed/test-users.sql
--
-- Staging (planned):
--   Run via GitHub Actions before E2E suite, against the staging branch.
--
-- ── Auth user creation ───────────────────────────────────────
-- This SQL inserts into public.tenants + public.users but CANNOT create
-- auth.users rows directly. For that, use the Supabase Admin API:
--
--   await supabase.auth.admin.createUser({
--     email: "owner@testa.dev",
--     password: "test-password-1234",
--     email_confirm: true,
--     user_metadata: { full_name: "Owner Test A" },
--   });
--
-- The auth user's UUID then needs to be linked to the public.users row.
-- See `e2e/fixtures/seed-auth.ts` for the wrapper that does both steps.
-- ============================================================

-- ─── Tenant A ───────────────────────────────────────────────
insert into public.tenants (id, name, gstin, state, state_code, address, email, phone)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Test Tenant A',
  '27TESTA0000A1Z5',
  'Maharashtra', '27',
  'E2E Test, Mumbai',
  'owner@testa.dev',
  '+91 90000 00001'
)
on conflict (id) do nothing;

-- ─── Tenant B ───────────────────────────────────────────────
insert into public.tenants (id, name, gstin, state, state_code, address, email, phone)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'Test Tenant B',
  '29TESTB0000B1Z9',
  'Karnataka', '29',
  'E2E Test, Bangalore',
  'owner@testb.dev',
  '+91 90000 00002'
)
on conflict (id) do nothing;

-- ─── Users — Tenant A ───────────────────────────────────────
-- IDs match what `e2e/fixtures/seed-auth.ts` writes into auth.users.
-- If you regenerate test users with different UUIDs, update both sides.
insert into public.users (id, tenant_id, email, full_name, role, can_view_deals, is_active, color)
values
  (
    '11111111-aaaa-1111-aaaa-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'owner@testa.dev',   'Owner A',   'owner',   true, true, 'amber'
  ),
  (
    '22222222-aaaa-2222-aaaa-222222222222',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'manager@testa.dev', 'Manager A', 'manager', true, true, 'indigo'
  ),
  (
    '33333333-aaaa-3333-aaaa-333333333333',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'sales@testa.dev',   'Sales A',   'sales',   true, true, 'emerald'
  )
on conflict (id) do nothing;

-- ─── Users — Tenant B ───────────────────────────────────────
insert into public.users (id, tenant_id, email, full_name, role, can_view_deals, is_active, color)
values
  (
    '11111111-bbbb-1111-bbbb-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'owner@testb.dev', 'Owner B', 'owner', true, true, 'rose'
  ),
  (
    '33333333-bbbb-3333-bbbb-333333333333',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'sales@testb.dev', 'Sales B', 'sales', true, true, 'slate'
  )
on conflict (id) do nothing;

-- ─── Sample leads — Tenant A ────────────────────────────────
-- 2 leads to give cross-tenant RLS tests something to verify against
-- (one Tenant A user must NOT see these via RLS as Tenant B).
insert into public.leads (id, tenant_id, company, contact_name, contact_email, contact_phone, stage, source, priority, owner_id, plan, seats, value)
values
  (
    'L-TESTA-001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Acme A Pvt Ltd',
    'Test Contact A1',
    'lead1@acmea.test',
    '+91 90000 11111',
    'new', 'manual', 'medium',
    '11111111-aaaa-1111-aaaa-111111111111',
    null, null, null
  ),
  (
    'L-TESTA-002',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Wayne A Industries',
    'Test Contact A2',
    'lead2@waynea.test',
    '+91 90000 22222',
    'demo', 'manual', 'high',
    '33333333-aaaa-3333-aaaa-333333333333',
    'Google Workspace Standard', 25, 220800
  )
on conflict (id) do nothing;

-- ─── Sample leads — Tenant B ────────────────────────────────
insert into public.leads (id, tenant_id, company, contact_name, contact_email, contact_phone, stage, source, priority, owner_id, plan, seats, value)
values
  (
    'L-TESTB-001',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Globex B Solutions',
    'Test Contact B1',
    'lead1@globexb.test',
    '+91 90000 33333',
    'new', 'manual', 'medium',
    '11111111-bbbb-1111-bbbb-111111111111',
    null, null, null
  ),
  (
    'L-TESTB-002',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Trim B Inc',
    'Test Contact B2',
    'lead2@trimb.test',
    '+91 90000 44444',
    'quote', 'manual', 'high',
    '33333333-bbbb-3333-bbbb-333333333333',
    'Microsoft 365 Business Premium', 50, 882000
  )
on conflict (id) do nothing;

# ResellerOS E2E Tests (Playwright)

End-to-end test suite covering critical user journeys and — most importantly — **multi-tenant RLS isolation**. With 200+ features shipped to a single shared Supabase project, the cost of a tenant-leak bug is existential. Automated tests are the only sane defense.

---

## Quick start

```bash
# from production/
npm install                # installs @playwright/test + browsers if missing
npx playwright install     # downloads Chromium + WebKit browser binaries (first time only)
npm run test:e2e           # runs the full suite headless
npm run test:e2e:ui        # interactive UI mode — pick which test to run
```

Default: Playwright auto-starts `npm run dev` on port 3000 and runs tests against it. Override with `PLAYWRIGHT_BASE_URL=https://staging.example.dev npm run test:e2e` to hit staging.

---

## Architecture

```
e2e/
├── README.md                   # this file
├── smoke.spec.ts               # auth-free sanity check (login renders, redirects work)
├── fixtures/
│   ├── seed-auth.ts            # programmatically create test auth users via Admin API
│   └── (planned) login.ts      # storageState helpers for each role
└── (planned)
    ├── lead-flow.spec.ts       # full lead → quote → payment → invoice journey
    ├── cross-tenant.spec.ts    # RLS isolation — tenant A cannot see tenant B
    └── role-permissions.spec.ts # sales role can't reach owner-only routes
```

---

## Test data — seeding

E2E tests rely on a known fixture roster: **2 tenants × 5 users + sample leads**. The seed is split across two files because Supabase auth schema is admin-only:

**1. `supabase/seed/test-users.sql`** — public data (tenants, users, leads).
Idempotent SQL — safe to re-run. UUIDs are hardcoded so test files can reference them.

**2. `e2e/fixtures/seed-auth.ts`** — auth.users rows.
Calls Supabase Admin API to create the auth users with matching UUIDs. Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.test` (gitignored).

### Re-seeding locally

```bash
# wipe + reset local Supabase
supabase db reset

# apply test fixtures
psql $SUPABASE_DB_URL -f supabase/seed/test-users.sql

# create auth users (requires .env.test with service key)
node -r dotenv/config -e "require('./e2e/fixtures/seed-auth').ensureTestAuthUsers()"
```

### Re-seeding staging (planned CI)

GitHub Actions runs both steps before the E2E suite:
1. `supabase db push --db-url $STAGING_DB_URL`  (apply migrations)
2. `psql $STAGING_DB_URL -f supabase/seed/test-users.sql`  (apply fixtures)
3. Node script calls `ensureTestAuthUsers({ supabaseUrl, serviceRoleKey })`
4. `npm run test:e2e`

---

## Fixture roster

| Email | Tenant | Role | Notes |
|---|---|---|---|
| `owner@testa.dev` | Test Tenant A | owner | Full access, all of A's leads |
| `manager@testa.dev` | Test Tenant A | manager | Most of owner's access except some admin |
| `sales@testa.dev` | Test Tenant A | sales | Lead-focused — restricted views |
| `owner@testb.dev` | Test Tenant B | owner | Used for cross-tenant tests |
| `sales@testb.dev` | Test Tenant B | sales | |

Password: `test-password-1234` (same for all — test data only, never used in prod).

UUIDs are deterministic and shared between SQL + TS so RLS tests can hard-code them:

```ts
import { TENANT_A_ID, TENANT_B_ID, getTestUser } from "./fixtures/seed-auth";
```

---

## What MUST be tested (P0 priorities)

1. **Auth bouncing** — unauthenticated `/leads` → `/login`. (✅ in smoke.spec.ts)
2. **RLS leak — direct supabase query** — Tenant A's session cannot `SELECT` from Tenant B's `leads`/`quotes`/`invoices`/`customers`/`payments`.
3. **RLS leak — UI** — login as Tenant A, check no Tenant B data renders anywhere.
4. **Role gates** — sales user → `/customers` → redirected. Sales user → `/accounting/saas-metrics` → redirected.
5. **Critical write paths** — record_payment RPC succeeds + auto-converts lead → customer.
6. **Document numbering** — concurrent `next_document_number('invoice')` calls don't collide.
7. **Cross-tenant invoice → vendor_bill trigger** — Tenant A's child (Tenant B) gets a vendor_bill when A invoices B.

---

## What NOT to test in E2E (use unit tests for these)

- Pricing math (rupee formatting, ×12 annualization, GST split) → Vitest.
- Form validation (Zod schemas) → Vitest.
- Date/timezone math (daysBetween) → Vitest.

E2E should cover **user journeys + integration boundaries**, not pure functions.

---

## Debugging

- `npx playwright test --debug` — opens browser, pauses at each step.
- `npx playwright show-report` — opens the HTML report after a run.
- Test failures save traces, screenshots, and videos to `test-results/`.
- For multi-tenant flakiness, add `await page.context().storageState({ path: "tmp.json" })` mid-test to inspect what cookies are set.

---

## CI

Planned `.github/workflows/ci.yml`:
- On PR open / push to main: run typecheck, lint, smoke tests against a staging Supabase branch.
- On nightly cron: run the full suite + RLS-leak tests.
- On merge to main: trigger Cloud Run deploy.

The CI pipeline is the next deliverable in the Critical Infrastructure sprint (Week 1, Day 4).

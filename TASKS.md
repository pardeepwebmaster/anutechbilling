# Tasks

> Living task list — main ise update karta rahunga. Jaise-jaise kaam complete hoga, task `Done` mein strikethrough ho jayega. Tum bhi edit kar sakte ho. Visual board ke liye `dashboard.html` browser mein kholo.
> Full detail: [docs/MONEY-FLOW-TEST-MATRIX.md](docs/MONEY-FLOW-TEST-MATRIX.md) · context: [docs/PROJECT-KNOWLEDGE.md](docs/PROJECT-KNOWLEDGE.md)

## Active

### 🚦 Launch blockers — fix order (audit Section 6)
- [x] ~~**1. record_payment idempotency**~~ ✅ DONE (30 May 2026) - bugs #1 & #2 fixed
  - Migration `0051_record_payment_idempotency.sql` applied to DB (project resellersos)
  - Unique index `payments(tenant_id, quote_id, reference) WHERE status='received'` + early RPC guard + race backstop
  - Verified red→green on test DB: same ref 2× → 1 row (was 2); distinct refs 2× → 2 rows (partial payments safe)
  - Regression test committed: `production/supabase/tests/record_payment_idempotency.test.sql`
  - Bug #2 (webhook): covered — webhook already passes Razorpay `payment.id` as reference, so RPC guard dedupes retries
- [ ] **1b. Bug #5 — record_payment 8b clobbers sibling subs' outstanding** (split from #1) - needs `subscriptions.quote_id` FK to scope the UPDATE to the originating sub (RP-03)
- [ ] **2. Add-seats / Extend duplicate-subscription fix** - tumne jo bug pakda (bugs #3,#4,#6,#16)
  - Mark add-seats quotes (`is_add_seats`) + skip record_payment step 8a for them
  - Fully-paid + annual + no-customer → raise (no silent no-sub)
  - Extend: resolve renewal purely by `renewal_quote_id`
  - SQL test: pay → exactly 1 correct subscription (AS-01/02/08, EX-05, RP-11/12)
- [ ] **3. Pricing unify — one shared price engine** - charged price == shown price (bugs #10,#11,#12)
  - Extract single `buildWorkspaceLines()`; enquiry + checkout + calculator all read catalog
  - Decide catalog `msrp` = retail vs cost; model promo in catalog
  - Vitest price-parity test: same tier+seats → equal total across all 3 engines (PR-01..04)
- [ ] **4. Atomic generate_invoice RPC** - ek supply = ek invoice (bugs #7,#8,#9,#25,#26)
  - `SECURITY DEFINER generate_invoice(p_quote_id)` with `FOR UPDATE` + `UNIQUE(quote_id)`
  - Freeze GST split (cgst/sgst/igst/place_of_supply) at generation (bug #24)
  - SQL test: concurrent generate → 1 invoice, no orphan (INV-02/03/09)
- [ ] **5. accept_quote RPC** - "Mark accepted" button abhi hard-error deta hai (bug #14)
  - Author migration `accept_quote(p_quote_id)` (reuse lead→customer conversion) OR disable button until then
- [ ] **6. GST split + IST expiry fixes** - customer-visible correctness (bugs #18,#19,#20)
  - Derive inter-state in quote-send PDF + renewal PDF; end-of-day IST for quote expiry
  - Vitest: GST split + TZ-expiry (LQ-A5/Q5, RN-18, INV-04)
- [ ] **7. Playwright happy-path E2E** - build→send→accept→pay smoke, runs every deploy
- [ ] **CI to auto-run money tests (GitHub Actions)** - ⚠️ BLOCKED on schema-drift first: a fresh DB built from git migrations is missing prod-only columns (`extension_months`, `trial_*`), so the SQL tests would fail in CI. Run `supabase db diff` to capture drift into a migration, THEN wire CI. Until then, run tests manually against the dev DB.

### 💰 Business-readiness (revenue unlock, parallel)
- [ ] **Razorpay live mode + paywall (tier enforcement)** - pehla ₹1 lene ke liye
- [ ] **Audit logs** - `audit_log` table + wrap mutations
- [ ] **Soft launch with 1-3 design-partner customers** - public launch nahi, friendly cohort first

## Waiting On
- [ ] **Pardeep: `resellersos.in` domain khareedo** - ~₹1000, 5 min (custom domain + email)
- [ ] **Pardeep: Razorpay live KYC complete karo** - live keys ke liye
- [ ] **Pardeep: decide karo — money unit ₹ ya paise?** - schema vs CLAUDE.md ambiguity (bug #36)
- [ ] **Pardeep: catalog `msrp` ka matlab — retail ya cost?** - pricing fix ke liye zaroori (bug #12)

## Someday
- [ ] Capture `redeem_coupon`/`coupons`/`site_promos` into migration files (schema drift, bug #34)
- [ ] TDS atomic with payment (bug #22) · cadence catch-up (bug #21) · coupon units guard (#31)
- [ ] e-Invoice IRP (ClearTax) · DPA template · data export (DPDP)
- [ ] AI feature #1 (lead scoring / quote suggestion)
- [ ] **Auto-provisioning helper (differentiator, validated by Pardeep)** — Pardeep provisions via Google Partner Sales Console, finds it "confusing." Scope FIRST: (A) guided in-app checklist/wizard (cheap, no API, kills most confusion) vs (B) full Google Workspace Reseller API automation (needs reseller API access). NOT a launch blocker — after money-spine + revenue.
- [ ] All remaining P2 items from MONEY-FLOW-TEST-MATRIX.md Section 4

## Done

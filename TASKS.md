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
- [x] ~~**2. Add-seats duplicate-subscription fix**~~ ✅ DONE (30 May 2026) - bugs #3 & #4 (the bug Pardeep found in testing)
  - Migration `0052`: added `quotes.is_add_seats`; record_payment skips ALL sub handling for add-seats quotes
  - `add-seats.ts` now sets `is_add_seats: true`; `database.types.ts` updated; typecheck green
  - Verified red→green on test DB: customer with 1 sub + add-seats pay → 1 sub (was 2); new sale still → 1 sub
  - Regression test committed: `production/supabase/tests/add_seats_no_duplicate_subscription.test.sql`
- [ ] **2b. Extend-on-already-renewed edge (#16) + silent-no-sub (#6)** (remaining from #2) - extend on a `renewed` sub still dup-creates (detection filter `renewal_state <> 'renewed'`); fully-paid+annual+no-customer should raise instead of silently making no sub
- [x] ~~**🔴 NEW P0 — cross-tenant global doc-id collision**~~ ✅ FIXED (30 May 2026) - `quotes`/`invoices`/`purchase_orders` ids are GLOBAL text PKs but numbered per-tenant → two tenants both made `Q-2026-27-0009` → collision (confirmed live: broke buy-page quote creation). Fix: migration 0054 — `tenants.doc_code` (ET/ANU) embedded in doc numbers → `Q-ET-2026-27-0012` vs `Q-ANU-2026-27-0012` (globally unique, no FK/PK change, existing ids untouched). Applied to prod + regression test committed. Storefront also re-pointed to Excel Tech (fbb976f1).
- [~] **3. Pricing unify** - charged price == shown price (bugs #10,#11,#12) — PARTIAL
  - [x] ✅ Architectural fix (30 May): shared `src/lib/pricing/workspace.ts`; enquiry + checkout both price from the catalog (single source of truth). Removed enquiry's hardcoded ₹270/₹864/₹1080 + first-20 promo. Checkout fallback aligned to catalog. 6 Vitest tests + typecheck green.
  - [x] ✅ VALUE RESOLVED (30 May): Pardeep confirmed via Google's site — real India price is Starter **₹270**, Standard **₹864** (current 20%-off of ₹1080 list). Catalog `items.msrp` updated (was mis-seeded ₹136/₹736 = ~half price → live underpricing fixed). Code fallbacks + Vitest updated to match. (Claude's ₹136/₹736 belief was outdated — Pardeep's Google screenshot was authoritative.)
  - [ ] Polish: model the Standard 20%-off as a proper promo (show ₹1080 strikethrough + badge) via site-promo system, instead of baking ₹864 into msrp — so it auto-reverts when Google's promo ends.
  - [ ] Check COST side: Starter/Standard wholesale (₹110/₹620) give 59%/28% margin vs Plus/Enterprise ~10-15% — wholesale may be mis-seeded too low (affects profit reports, not customer price).
- [~] **4. Invoice atomicity** - ek supply = ek invoice (bugs #7,#8,#9,#25,#26) — PARTIAL
  - [x] ✅ DONE (30 May): `invoices(quote_id)` UNIQUE index (migration 0053) — duplicate invoice now impossible (bug #7). Verified red→green; regression test committed.
  - [ ] Remaining: move generation into `SECURITY DEFINER generate_invoice(p_quote_id)` with `FOR UPDATE` (bugs #8 race, #9 orphan); freeze GST split (#24); client catches unique_violation gracefully
- [x] ~~**5. accept_quote RPC**~~ ❌ FALSE ALARM (verified 30 May) - audit #14 was WRONG: `accept_quote(p_quote_id)` EXISTS in the DB (audit checked migration files, not live DB). "Mark accepted" does NOT crash.
  - Real issue surfaced = **schema drift**: `accept_quote`, `redeem_coupon`, `create_site_promo` + `coupons`/`site_promos` tables exist in prod but NOT in committed migrations. Capture via `supabase db diff` (also unblocks CI). See bug #34.
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

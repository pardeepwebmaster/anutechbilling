# Tasks

> Living task list — main ise update karta rahunga. Jaise-jaise kaam complete hoga, task `Done` mein strikethrough ho jayega. Tum bhi edit kar sakte ho. Visual board ke liye `dashboard.html` browser mein kholo.
> Full detail: [docs/MONEY-FLOW-TEST-MATRIX.md](docs/MONEY-FLOW-TEST-MATRIX.md) · context: [docs/PROJECT-KNOWLEDGE.md](docs/PROJECT-KNOWLEDGE.md)

## Active

### ✅ In-app E2E spine verification — PASSED in production (31 May 2026)
- [x] ~~**Full money-spine walked through live app UI**~~ — lead `L-ZZTESTUI1` (buy-workspace, stage New) → quote `Q-ET-2026-27-0016` (draft → sent → accepted) → customer created → payment ₹1,22,342 (ref `ZZTEST-UPI-0001`) → subscription (10 seats, active) → invoice `INV-ET-2026-27-0006` (paid). DB cross-check: **exactly 1 of each — zero duplicates**. Confirms idempotency, no-dup-sub, one-invoice-per-quote, tenant-scoped doc IDs (the `ET` code in `INV-ET-...`) all working in PROD via real UI flow.
- [x] ~~**UI copy nit:** lead drawer heading "QUOTES SENT" → "Quotes"~~ ✅ FIXED (31 May) — `leads/page.tsx`
- [x] ~~**UI copy nit:** draft quote showed "Revise & resend · Sent today"~~ ✅ FIXED (31 May) — draft now shows "Send draft quote" (smart-CTA + footer button + helper text gated on `status === "draft"`). Typecheck green. Committed (not yet deployed).
- [x] ~~**Cleanup:** QA test data removed from prod (31 May 2026)~~ — lead `L-ZZTESTUI1`, quote `Q-ET-2026-27-0016`, payment `ZZTEST-UPI-0001`, invoice `INV-ET-2026-27-0006`, subscription `567d6542…`, customer `f68384a1…` deleted FK-safe (child→parent, single txn). Verified all 6 = 0 rows.

### 🚦 Launch blockers — fix order (audit Section 6)
- [x] ~~**1. record_payment idempotency**~~ ✅ DONE (30 May 2026) - bugs #1 & #2 fixed
  - Migration `0051_record_payment_idempotency.sql` applied to DB (project resellersos)
  - Unique index `payments(tenant_id, quote_id, reference) WHERE status='received'` + early RPC guard + race backstop
  - Verified red→green on test DB: same ref 2× → 1 row (was 2); distinct refs 2× → 2 rows (partial payments safe)
  - Regression test committed: `production/supabase/tests/record_payment_idempotency.test.sql`
  - Bug #2 (webhook): covered — webhook already passes Razorpay `payment.id` as reference, so RPC guard dedupes retries
- [x] ~~**1b. Bug #5 — record_payment clobbers sibling subs' outstanding**~~ ✅ FIXED (31 May 2026, migration 0056) - proven red (sibling 3000→2000), then fixed: added `subscriptions.quote_id` (FK), stamped on sub creation, scoped the outstanding UPDATE to `quote_id = p_quote_id`. Red→green + regression test `record_payment_sibling_and_extend.test.sql`. No regression (add-seats/new-sale/idempotency all green).
- [x] ~~**2. Add-seats duplicate-subscription fix**~~ ✅ DONE (30 May 2026) - bugs #3 & #4 (the bug Pardeep found in testing)
  - Migration `0052`: added `quotes.is_add_seats`; record_payment skips ALL sub handling for add-seats quotes
  - `add-seats.ts` now sets `is_add_seats: true`; `database.types.ts` updated; typecheck green
  - Verified red→green on test DB: customer with 1 sub + add-seats pay → 1 sub (was 2); new sale still → 1 sub
  - Regression test committed: `production/supabase/tests/add_seats_no_duplicate_subscription.test.sql`
- [~] **2b. Extend-on-already-renewed (#16) ✅ FIXED + silent-no-sub (#6) deferred** (migration 0056)
  - [x] ✅ **#16 (31 May)** — proven red (extend-on-`renewed` sub → 2 subs), then fixed: dropped the `renewal_state <> 'renewed'` filter from the renewal-sub lookup so a quote that is a sub's `renewal_quote_id` ALWAYS rolls that sub forward (no duplicate). Idempotency unaffected (payment dedup returns first; `renewal_quote_id` nulled after completion). Regression test green; same dup-sub class as the bug Pardeep originally found.
  - [ ] **#6 (deferred, low-risk):** fully-paid + annual + no-customer silently makes no sub. A defensive `raise` could block a legit edge; left as documented fast-follow (rare — quotes always have a customer or lead in practice).
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
- [~] **6. GST split + IST expiry fixes** - customer-visible correctness (bugs #18,#19,#20) — GST HEAD DONE, IST expiry pending
  - [x] ✅ **GST head (IGST vs CGST/SGST) derivation unified (31 May)** — new `src/lib/gst/place-of-supply.ts` `isInterStateSupply(customerStateCode, sellerStateCode)` + 5 Vitest (green). Replaced hardcoded GST head in **all** authoritative surfaces: quote-builder (was seller="27"!), quote-send PDF route (was false), quote-detail preview+download, whatsapp-send PDF, cron-renewals PDF, renewals/send-now PDF. Tax-invoice view + receipt-voucher already derived → refactored to the shared helper. Typecheck green.
  - [x] ✅ **Excel Tech GST profile set (31 May)** — `state='Delhi (07)'`, `state_code='07'`, `gstin='07BMOPS5609G1ZM'` (Pardeep-provided). Now seller state is known → head derives correctly.
  - [x] ✅ **Journey 1 (IGST) + Journey 3 (CGST/SGST) verified LIVE (31 May, deploy rev resellersos-00072-ssv)** — same Standard×10 (₹1,03,680) for a Maharashtra (27) vs Delhi (07) customer: MH → **IGST ₹18,662** (single line), Delhi → **CGST ₹9,331 + SGST ₹9,331**; both total ₹1,22,342. Verified across quote-builder, customer-facing quote PDF ("Inter-state (IGST applies)"), AND the legal **Tax Invoice** (IGST @ 18% ₹18,662, ITC note per CGST §31, advance adjusted per Rule 53). Receipt Voucher RV-ET-…-0008 also generated (Journey 1 step 6). Full spine again 1-of-each, zero dups. Test data cleaned.
  - [x] ✅ **FU2: Quotes LIST quick-preview GST head fixed (31 May)** — extracted to `QuotePreviewContainer` which fetches the customer + derives via `isInterStateSupply()`. (commit d4ff0e6)
  - [x] ✅ **FU3: end-of-day IST quote expiry (31 May)** — `endOfDayIST()`+`isQuoteExpired()` in lib/utils (23:59:59.999 IST), used in the public quote-accept route; 7 Vitest. A quote "valid until 30 Jun" no longer lapses at 05:30 IST dawn. (commit d4ff0e6)
  - [x] ✅ **FU1: buy-page captures place-of-supply → inter-state leads bill IGST (31 May)** — migration 0055 adds `leads.state_code`/`state` + makes accept_quote & record_payment copy state_code/state/gstin lead→customer; buy form has a "Your state (GST)" dropdown; enquiry route stores it. SQL regression test green (record_payment: MH lead → customer state_code=27, 1 sub). accept_quote copy verified via in-app E2E. (commit 3b76249) — captures both RPCs into version control too (drift #34, partial).
  - [ ] Vitest: GST split + TZ-expiry (LQ-A5/Q5, RN-18, INV-04)
- [ ] **7. Playwright happy-path E2E** - build→send→accept→pay smoke, runs every deploy
- [x] ~~**CI (GitHub Actions)**~~ ✅ LIVE (30 May) - private GitHub repo `Pardeep-byte1/resellersos`; `.github/workflows/ci.yml` runs typecheck + Vitest + lint on every push/PR. GREEN. Already caught a real bug (vitest was globbing Playwright e2e specs → added vitest.config.ts). Working branch is now **master** (= GitHub).
- [ ] **CI: add SQL money-RPC tests** - still pending: needs a Postgres in CI + full schema (blocked on schema-drift capture via `npx supabase`). Until then the SQL tests in `production/supabase/tests/` run manually.

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

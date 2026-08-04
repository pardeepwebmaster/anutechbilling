# ResellerOS V3 — Money-Flow Test Matrix & Bug Report

_Original audit assembled: 2026-05-29 (six segment trace audits: lead→quote, pricing, record_payment core, add-seats/extend, invoice generation, renewal cadence)._
_**Revised: 2026-06-01** — re-verified against live DB + code after the fix wave (migrations 0051–0061 + code). Current per-bug status is in **§2.1**; Sections 3 & 4 are preserved as the original-audit snapshot. **Verification basis:** live `pg_proc`/`pg_indexes` inspection, the SQL regression suite in `production/supabase/tests/` (all green), and a full in-app E2E walk of the spine on prod (zero duplicates)._

---

## 1. How to read this

A **scenario** is one concrete situation written as **setup → action → expected**: what state the data is in, what someone does, and what the system *should* do. A scenario is "green" only when the actual behaviour matches the expected behaviour. Bugs are ranked by **severity**: **P0** = money is wrong, double-charged, or a payment/subscription silently vanishes — do not charge real money until fixed; **P1** = customer-visible wrongness (wrong tax document, wrong price, locked-out customer, broken operator action) that must be fixed before scale but is not silently losing money in the common path; **P2** = polish, edge cases, or latent risks that can ship with a known-issue note. Throughout, "money-wrong" means a rupee figure, a tax split, or a subscription/invoice record is incorrect — the things that get a reseller into trouble with customers or with GST.

---

## 2. The core spine at a glance

The spine is: **lead → quote → pay → subscription → invoice → renewal**. One-line health per stage:

_(arrows show the change since the 2026-05-29 audit)_

| Stage | Health | One-line (current) |
|-------|--------|----------|
| **Lead capture** | ✅ | Manual, enquiry, and trial lead creation all work; minor inconsistencies only. |
| **Quote (build + send + accept)** | 🔴→✅ | `accept_quote` RPC exists (the "missing RPC" was a false alarm); customer self-accept now converts the lead → customer + `won` (#17, migration 0059); IST expiry fixed (#18); emailed PDF derives the correct GST head (#19). |
| **Pricing of that quote** | 🔴→✅ | Enquiry and buy-page/checkout now price from **one catalog source** and yield identical totals (#10/#11); catalog re-seeded to confirmed retail (#12); place-of-supply captured for GST head (#23). |
| **Pay (record_payment core)** | 🔴→✅ | Idempotent on `(tenant_id, quote_id, reference)` (#1/#2, migration 0051); sibling-sub balances no longer clobbered (#5, 0056); MRR stored ex-GST; null/zero-amount quote rejected (#27, migration 0061). Seats=0 guard (#28) is fast-follow. |
| **Subscription changes (add-seats / extend)** | 🔴→✅ | Add-seats no longer duplicates the subscription (#3/#4, 0052); extend-on-already-renewed no longer duplicates (#16, 0056). Concurrent-add lost-update (#33) is fast-follow. |
| **Invoice generation** | 🔴→✅ | Atomic `generate_invoice` SECURITY DEFINER RPC (migration 0058): one invoice per quote (#7, unique index 0053), `FOR UPDATE` kills the race (#8), insert+quote-update in one txn kills orphans (#9), number allocated in-txn kills seq gaps (#25); ₹0 invoice rejected (#26, migration 0060). GST-split freeze (#24) is fast-follow. |
| **Renewal cadence + roll-forward** | ⚠️→✅ | Roll-forward correct; renewal PDF derives the right GST head (#20); extend-dup fixed (#16). Cadence catch-up (#21) + hard-suspend grace policy (#35) are fast-follow. |

**Bottom line (2026-06-01): the money-spine is soft-launch-ready for an intra-state pilot.** Both architectural root causes from the May audit are **resolved**: (a) payment idempotency + **atomic money RPCs now exist** — `record_payment`, `accept_quote`, `generate_invoice` are all `SECURITY DEFINER` and verified live in `pg_proc`; and (b) the price engines now read **one catalog source** and produce identical totals. All seven stages were walked end-to-end on live prod with **zero duplicates**, and the SQL regression suite is green. The remaining items are narrower **P1/P2 fast-follows** (GST-split freeze on the invoice record, a seats=0 guard, cadence catch-up, monthly-flex unit, coupon-unit guard, coupon/promo schema-drift capture) — none silently lose money on the common path. The real launch gates are now **operational, not architectural**: Razorpay live KYC, Resend domain verification, and the production domain.

---

## 2.1 Fix status since the 2026-05-29 audit

Re-verified 2026-06-01 against live DB + code. ✅ = fixed & evidenced · 🟡 = open fast-follow (not a launch blocker for an intra-state pilot).

| Bug | Was | Now | Evidence / what changed |
|-----|-----|-----|--------------------------|
| #1 No payment idempotency | P0 | ✅ | Migration 0051 — `payments_idempotency_uq` UNIQUE `(tenant_id, quote_id, reference) WHERE status='received'` + RPC early-guard. Verified live in `pg_indexes`. Regression test `record_payment_idempotency.test.sql`. |
| #2 Webhook dup (partial) | P0 | ✅ | Covered by #1's DB constraint; the Razorpay webhook passes `payment.id` as the reference, so retries dedupe. |
| #3/#4 Add-seats duplicate sub | P0 | ✅ | Migration 0052 — `quotes.is_add_seats`; `record_payment` skips all sub-handling for add-seats. Test `add_seats_no_duplicate_subscription.test.sql`. |
| #5 Sibling-sub balance clobber | P0 | ✅ | Migration 0056 — `subscriptions.quote_id` FK; outstanding UPDATE scoped to the originating quote. Test `record_payment_sibling_and_extend.test.sql`. |
| #6 Fully-paid + no customer → silent no-sub | P0 | ✅ | Closed by migration 0078 (verified live 2026-07-29 in `record_payment` body): on the first payment, a customer is ALWAYS created — from the lead if `lead_id` is set, else straight from the quote (`customer_name`) when both `lead_id` and `customer_id` are null. So the annual-sub branch's `v_customer_id is not null` guard can no longer fall through to a silent no-sub. |
| #7 Duplicate invoices per quote | P0 | ✅ | Migration 0053 — `invoices_quote_unique`. Verified live. |
| #8 Invoice snapshot race | P0 | ✅ | Migration 0058 — atomic `generate_invoice` RPC, `SELECT … FOR UPDATE` on the quote. Test `generate_invoice_atomic.test.sql`. |
| #9 Orphan invoice (quote not flipped) | P0 | ✅ | Migration 0058 — invoice INSERT + quote UPDATE in one transaction. |
| #10 Enquiry price ≠ buy-page price | P0 | ✅ | `lib/pricing/workspace.ts` is the single source (`buildWorkspaceLines`); enquiry imports it, checkout's inline copy verified byte-identical (fallback 270/864/1380/2400, same priority + ×1.18 GST) → same total. |
| #11 Promo in only one engine | P0 | ✅ | Hardcoded first-20 promo removed from enquiry; promos now flow through the coupon / site-promo system for all engines. |
| #12 Catalog rates mis-scaled | P0 | ✅ | Pardeep-confirmed retail (Starter ₹270, Standard ₹864 = current 20%-off of ₹1080); catalog `msrp` re-seeded; Vitest updated. |
| #13 Catalog-vanish fallback overcharge | P0 (rare) | 🟡 | Mitigated — the fallback table now equals catalog retail, so a mid-session catalog miss no longer overcharges. Fast-follow: return 400 ("price changed, refresh") instead of silently using the fallback. |
| #14 `accept_quote` RPC missing | P0/P1 | ✅ | **False alarm** — `accept_quote(p_quote_id)` exists as `SECURITY DEFINER`; verified in `pg_proc`. Audit checked migration files, not the live DB. |
| #15 Double roll-forward (ext < 12mo) | P0 (edge) | ✅ | Migration 0056 + payment idempotency + `renewal_quote_id` nulled after completion → cannot re-roll. |
| #16 Extend-on-already-renewed dup | P0 (edge) | ✅ | Migration 0056 — renewal resolved purely by `renewal_quote_id = p_quote_id`. Test in `record_payment_sibling_and_extend.test.sql`. |
| #17 Public accept doesn't convert lead | P1 | ✅ | Migration 0059 — `accept_quote` made service-role-safe (derives tenant from the quote when no auth context); public accept route now calls it → lead→customer + `won` + `payment_status='awaiting'`. Test `accept_quote_public_conversion.test.sql`. |
| #18 IST quote-expiry off-by-a-day | P1 | ✅ | `endOfDayIST` + `isQuoteExpired` (23:59:59 IST); used in the public accept route. 7 Vitest. |
| #19 Send-route PDF wrong GST head | P1 | ✅ | `isInterStateSupply()` shared helper; send route derives the head from customer vs tenant state. |
| #20 Renewal PDF wrong GST head | P1 | ✅ | cron-renewals PDF now derives via `isInterStateSupply()`. |
| #23 No place-of-supply captured | P1 | ✅ | Migration 0055 — `leads.state_code/state` → copied to customer by `accept_quote`/`record_payment`; buy page has a "Your state (GST)" dropdown. |
| #22 TDS insert non-atomic | P1 | ✅ | Fixed 2026-07-29 (migration 0150) — `record_payment_with_tds` wraps `record_payment` and inserts the TDS receivable in the SAME transaction; the TDS row commits with the payment or both roll back. `record_payment` itself is untouched. Replay-guarded (no dup TDS on retry). The dialog calls the wrapper only when TDS is deducted. Rolled-back test: co-commit (pay+TDS linked) + replay-no-dup both green. |
| #24 GST split not frozen on invoice | P1 | ✅ | `generate_invoice` freezes `taxable_value/tax_amount/tax_rate/inter_state` at issue (migration 0116). The viewer/PDF still re-derived `interState` from the *current* customer state — fixed 2026-07-29: `tax-invoice-dialog.tsx` now reads the frozen invoice columns (props are legacy fallback only), so a later customer-state edit can no longer flip an issued invoice's heads. Cross-checked live: INV-ET-2026-27-0002 renders intra-state / ₹32,400 taxable == frozen row. |
| #25 Invoice sequence gaps | P1 | ✅ | Fixed by 0058 — the number is allocated **inside** the atomic txn, so a failed INSERT rolls back the increment too. |
| #26 ₹0 "paid" tax invoice | P1 | ✅ | Migration 0060 — `generate_invoice` raises on `gross <= 0` (guard on gross only; advance-settled net 0 still invoices). Test `zero_amount_guards.test.sql`. |
| #27 NULL amount → every payment "fully paid" | P1 | ✅ | Migration 0061 — `record_payment` raises when the quote's `amount <= 0` (placed after the idempotent-replay check). Verified by the full suite (mrr-ex-gst, replay, renewal, partial, sibling) + ₹0-reject. |
| #28/#29/#30/#31/#32/#33/#34/#35/#36 | P1/P2 | 🟡 | Open fast-follows: seats=0 guard, monthly no-sub, monthly-flex ×12 unit, coupon-unit guard, extend clobber race, add-seats lost-update lock, coupon/promo schema-drift capture, hard-suspend grace policy, rupee/paise unit decision. None block an intra-state pilot. **#34 note:** the drift is wider than line 112 records — 3 tables (incl. `coupon_redemptions`) + 5 functions + 2 triggers; full inventory + the `supabase db diff` capture step are in `TASKS.md`. |

**Score: of the 16 P0 / P0-edge items, 14 are fully resolved; #6 is a documented rare deferral and #13 is mitigated (the fallback table now equals catalog retail, so a catalog-miss no longer overcharges — only the explicit 400-on-miss refinement is pending). The two dominant root causes are closed.** Remaining work is P1/P2 hardening.

---

## 3. Prioritized BUG LIST

> ⚠️ **This section is the original 2026-05-29 audit snapshot** (severities + root-cause file:line as first found). For current fix status see **§2.1**. Bugs marked ✅ there are fixed in migrations 0051–0061 + code.

Sorted P0 first. "Test that would catch it" names the scenario ID(s) in Section 4.

| # | Flow | What's wrong | Severity | Root cause (file:line) | Fix sketch | Test that would catch it |
|---|------|--------------|----------|------------------------|------------|--------------------------|
| 1 | Pay (core) | **No idempotency on `(quote_id, reference)`.** Calling `record_payment` twice with the same reference inserts a SECOND payment row, double-counts received total, can flip partial→received/overpaid, double-issues a receipt voucher. | **P0** | `payments` has unique index only on `(tenant_id, receipt_voucher_no)`, none on `(quote_id, reference)`; RPC inserts unconditionally — `0047_record_payment_marks_quote_accepted.sql:153-157`; admitted as tech debt in `0006`:382-386 | Add `CREATE UNIQUE INDEX … ON payments(tenant_id, quote_id, reference) WHERE status='received'`; RPC catches unique-violation and returns the existing row (true idempotency). | RP-04, RP-05, RP-06 |
| 2 | Pay (webhook) | **Razorpay idempotency guard misses partial payments.** Guard only short-circuits when `quote.payment_status='received'`; a duplicate webhook for a *partial* capture re-calls `record_payment` and double-counts. | **P0** | `api/webhooks/razorpay/route.ts:133` (`if quote.payment_status === "received"`) | Dedupe on the Razorpay `payment.id`, not on quote status; or rely on bug #1's DB constraint. | RP-05, RP-06 |
| 3 | Add-seats | **Paying an add-seats quote creates a DUPLICATE subscription.** The add-seats quote has `commitment:"annual_yearly"` and is never linked to the sub, so `record_payment` step 8a treats it as a brand-new annual sale and inserts a second sub → double MRR/ARR, duplicate auto-PO, double renewal reminders, customer over-billed next renewal. | **P0** | quote created annual + unlinked — `lib/subscriptions/add-seats.ts:117,151-157` (no `renewal_quote_id` set); step 8a fires — `0047…sql:167,188-193` | Mark add-seats quotes with an explicit kind (e.g. `is_add_seats`) and add `and not v_is_add_seats` to the 8a condition; or skip 8a when a sub already exists for that customer+plan. | AS-01, AS-02, AS-08 |
| 4 | Add-seats | **Duplicate sub fires on the FIRST PARTIAL payment too** — 8a is gated on `v_is_first_payment`, not on fully-paid. | **P0** | `0047…sql:167` (condition omits fully-paid check) | Tie to bug #3; exclude add-seats from 8a entirely. | AS-02 |
| 5 | Pay (core) | **Repeat-payment branch (8b) clobbers UNRELATED subscriptions' outstanding.** Writing the balance on one deal resets every other sub of that customer to this quote's outstanding figure → corrupt AR ledger and dunning. | **P0** | `0047…sql:199-202` (`UPDATE subscriptions … WHERE customer_id = v_customer_id AND outstanding_amount > 0`); no `subscriptions.quote_id` FK (flagged `0006`:278-282) | Add `subscriptions.quote_id` (source-quote FK) and scope the UPDATE to the originating sub; or skip 8b until the FK exists. | RP-03 |
| 6 | Pay (core) | **Fully-paid quote with no resolvable customer creates NO subscription, silently.** Money recorded, quote marked received/accepted, but no sub, no PO, no AR tracking. | **P0** | `0047…sql:176` (`if v_is_annual and v_customer_id is not null`); `v_customer_id` only set by the conversion branch L122 | Raise an exception (fail the txn) when fully paid + annual but no customer can be resolved. | RP-11, RP-12 |
| 7 | Invoice | **No atomicity / no unique constraint → duplicate invoices per quote.** Two concurrent generates (double-click, bulk loop, retry) both pass the JS `invoice_id` check, both burn a distinct INV serial, both insert → two Tax Invoices for one supply, broken ITC/GSTR-1. | **P0** | client-side multi-write — `lib/queries/invoices.ts:137` (read-only guard), no `UNIQUE(quote_id)` (`0005` adds only a non-unique index L59) | Move whole flow into a `SECURITY DEFINER generate_invoice(p_quote_id)` RPC with `SELECT … FOR UPDATE` + re-check inside the txn; add `CREATE UNIQUE INDEX invoices_quote_unique ON invoices(quote_id) WHERE quote_id IS NOT NULL`. | INV-02, INV-09 |
| 8 | Invoice | **Snapshot race:** a `record_payment` landing between `compute_advance_adjustment` and the INSERT issues a Receipt Voucher instead of being reconciled into the just-issued invoice → invoice shows a balance the customer already paid. | **P0** | no lock on quote during generate — `lib/queries/invoices.ts:143` vs `:168`; auto-paid only runs when `v_has_existing_invoice` (`0047…sql:269-282`) | Same atomic RPC with `FOR UPDATE` on the quote — compute, insert, flip status under one lock. | INV-03 |
| 9 | Invoice | **Partial failure leaves an invoice without the quote flip** → quote re-lists in "awaiting invoice" → operator regenerates → duplicate (feeds bug #7). | **P0** | invoice INSERT (`invoices.ts:168`) and quote UPDATE (`:187`) are two separate awaited calls, no transaction | Fold both writes into the atomic RPC (single txn). | INV-09 |
| 10 | Quote pricing | **Enquiry quote price diverges from the buy-page/checkout price for the SAME tier.** Buy page shows Standard at catalog ₹736/user/mo; "Email me a quote" generates a draft at hardcoded ₹864/₹1080 → e.g. 10 seats ₹1,04,218 shown vs ₹1,22,342 quoted; 50 seats ₹5.21L vs ₹7.03L. | **P0** | hardcoded rates independent of catalog — `enquiry/workspace/route.ts:64-85,109-155` (header comment falsely claims "Numbers match the buy page") | Delete the hardcoded constants; have enquiry fetch the catalog the same way checkout does, or extract one shared `buildWorkspaceLines()`. | LQ-02, LQ-03, LQ-04 |
| 11 | Quote pricing | **"First-20-seats promo" exists in only one of three engines** (enquiry only). Catalog has no promo fields, so calculator/checkout charge flat per-seat; the promo a customer is told about never matches what Razorpay charges. | **P0** | promo logic split across `FALLBACK_TIERS.promoPrice` (display), `annualAmount` two-line split (enquiry), absent in checkout — `enquiry/workspace/route.ts` + `buy-workspace-client.tsx:402-403` | Model promo in the catalog (`prices.annual.promo_msrp` + `promo_max_seats`), all engines read it; or drop promo until centralized. | LQ-03 |
| 12 | Quote pricing | **Catalog rates look mis-scaled vs intended retail** (Starter ₹136 vs ₹270; Standard ₹736 vs ₹1080; Standard wholesale ₹620 → only ~16% margin vs ~30%+ model). Public page may be selling near wholesale. | **P0** | `DEFAULT_CATALOG` seeds Standard `msrp:736/wholesale:620` — `lib/queries/items.ts:148-154`; buy page uses `msrp` as retail | Confirm with founder whether catalog `msrp` is the customer price (re-seed ₹1080/₹270) or cost (add a retail column); align all engines. | PR-01, PR-04 |
| 13 | Quote pricing | **Catalog-disappears fallback silently overcharges.** If the SKU is disabled/edited between page load and checkout POST, server falls to `TIER_FALLBACK_MONTHLY` (Standard ₹1080) — 47% above the ₹736 just shown — and charges it with no re-confirmation. | **P0** (rare) | `checkout/workspace/route.ts:70-75,150`; client sends no price | On missing catalog row at checkout, return 400 ("price changed, please refresh") instead of charging a divergent constant. | PR-18 |
| 14 | Quote accept | **`accept_quote` RPC does not exist in the DB.** Every operator "Mark accepted" click hard-errors; the "customer said yes, will pay later" deal-tracking flow is entirely non-functional (no lead→customer, no `won`, KPIs blind). | **P0/P1** | `mark-accepted/route.ts:35` calls `supabase.rpc("accept_quote")`; verified absent in `pg_proc` and in all migrations | Author migration defining `accept_quote(p_quote_id)` SECURITY DEFINER (reuse the `0047` L122-139 conversion block), set lead `won`; or repoint mark-accepted at `record_payment` semantics. | LQ-A6 |
| 15 | Renewal | **Double roll-forward / stale state on sub-12-month extensions paid concurrently.** Roll-forward stamps `renewal_state='renewed'` only when `extension_months >= 12`; combined with the `renewal_state <> 'renewed'` detection filter, a partial-term extension can be re-matched and rolled forward twice (double extension + 2nd PO). | **P0** (edge) | stamp gated — `0047…sql:216`; detection filter — `0047…sql:113` | Always set `renewal_state='renewed'` on any fully-paid renewal; gate detection on `renewal_quote_id IS NOT NULL` + fully-paid only. | RN-17, RN-08 |
| 16 | Quote accept (extend edge) | **EXTEND on an already-`renewed` sub duplicates the subscription** — detection lookup filters out `renewed` subs so the extension is treated as a new sale → step 8a dup. | **P0** (edge) | `0047…sql:113` (`renewal_state <> 'renewed'`); `createExtensionQuote` sets `renewal_quote_id` regardless of state | Resolve renewal purely by `renewal_quote_id = p_quote_id`; let roll-forward decide the new state. | EX-05 |
| 17 | Quote accept | **Public customer "Accept" does not convert the lead or advance it.** Sets only `status='accepted', payment_status='awaiting'`; no customer record, lead stays at `quote`. Deal only materializes if/when `record_payment` runs. Code comment falsely claims a DB trigger sets payment_status (no trigger exists). | **P1** | `api/public/quote/[id]/accept/route.ts:40-46`, comment L39 | In the accept route (or a real trigger) also call the lead→customer conversion so accept and mark-accepted share one path (the bug #14 RPC). | LQ-A2, LQ-A7 |
| 18 | Quote accept | **Quote expiry is off by up to one day in IST.** `expires_date` (date-only) parses as UTC midnight; compared to real now, an IST customer is locked out ~5.5h early and effectively loses the whole last valid day. | **P1** | `api/public/quote/[id]/accept/route.ts:35` (`new Date(quote.expires_date) < new Date()`) | Compare against end-of-day in tenant TZ: `new Date(expires_date + "T23:59:59+05:30") < new Date()`. | LQ-A5 |
| 19 | Quote send | **Send-route PDF hardcodes intra-state GST regardless of customer.** The builder derives inter-state correctly, but the emailed quote PDF always renders CGST+SGST even for inter-state customers. | **P1** | `api/quotes/[id]/send/route.ts:167` (`interState: false`) | Compute `interState = customerStateCode !== tenantStateCode` from already-loaded customer/tenant and pass through. | LQ-Q5 |
| 20 | Renewal | **Renewal quote PDF hardcodes intra-state GST too.** Every renewal PDF shows CGST 9% + SGST 9%; inter-state customers get a wrong tax breakup on the customer-facing renewal document. | **P1** | `cron/renewals/route.ts:274` (`interState: false`), `:272` (`tax: subtotal*0.18`) | Derive `interState` from customer vs tenant state code; pass to `renderQuotePDF`. | RN-18 |
| 21 | Renewal | **Missed cadence days are never caught up.** Triggers match by exact day-equality (15/12/9/6/3/0); if cron misses the exact day (outage, deploy, clock skew) or an operator edits the renewal date to a non-trigger day (T-2, T-1), that reminder is permanently skipped — worst case only the T-0 final fires. | **P1** | exact-equality match — `lib/renewals/cadence.ts:108`; triggers `:36-43` | Switch to "highest unsent trigger whose day ≥ daysUntilRenewal", using `renewal_email_log` as the dedup source of truth. | RN-04, RN-05 |
| 22 | Pay (TDS) | **TDS receivable insert is non-atomic with the payment.** RPC settles the full amount (bank + TDS) against the quote; if the client-side TDS insert then fails, the quote shows fully-paid while the govt-owed TDS receivable is lost. | **P1** | `record-payment-dialog.tsx:231-264` (best-effort insert after RPC, swallows errors) | Pass TDS fields into a single atomic RPC so the TDS row commits with the payment. | RP-15 |
| 23 | Pay / Quote pricing | **Buy-page checkout never captures place-of-supply; GST split indeterminate.** Only `tax_rate:18`, a flat `amount`, and a free-text `gstin` are stored — no state code. CGST/SGST vs IGST cannot be computed for the eventual invoice. | **P1** | `checkout/workspace/route.ts:298-330` (no state); buy-page quote has `customer_id:null` | Derive state from GSTIN (chars 1-2) at checkout and persist `place_of_supply`/`state_code` on the quote. | PR-12, PR-13 |
| 24 | Invoice | **GST CGST/SGST/IGST split is not frozen; recomputed at view time.** Only `net_payable`/`advances`/`amount` are frozen; the dialog recomputes `interState` live from current customer state. A later customer-state edit retroactively flips an issued invoice's tax heads — immutable-document violation. | **P1** | `tax-invoice-dialog.tsx:105-107`; invoice row stores no `cgst/sgst/igst/place_of_supply` (`0001`/`0005`) | Freeze `inter_state`, `place_of_supply`, `taxable`, `cgst`, `sgst`, `igst` at generation; PDF reads frozen values. | INV-04 |
| 25 | Invoice | **Sequence gaps from consumed-but-unused invoice numbers.** `next_document_number` commits the increment; a later INSERT failure leaves a permanent gap (CGST Rule 46 requires gap-free serials). | **P1** | number allocated outside the doc-insert txn — `invoices.ts:156` vs `:168` | Allocate the number inside the atomic `generate_invoice` RPC so rollback un-consumes it. | INV-08 |
| 26 | Invoice | **NULL/zero quote amount yields a ₹0 "paid" tax invoice.** `grossAmount = quote.amount ?? 0` → amount 0, net 0, status `paid`, terminal quote, a real INV serial burned. | **P1** | `invoices.ts:152`; no `amount > 0` guard | Guard `if (!grossAmount || grossAmount <= 0) throw`; restrict eligibility to quotes with received payments. | INV-06 |
| 27 | Pay (core) | **NULL/zero quote amount makes every payment "fully paid."** `v_expected = coalesce(amount,0)`; any ₹1 marks quote received/accepted, outstanding 0, sub MRR 0. | **P1** | `0047…sql:104,161` | `if v_expected <= 0 then raise exception 'quote has no amount'`. | RP-08 |
| 28 | Pay / add-seats | **Missing/zero seats produces a seats=0 subscription + wrong PO cost.** | **P1** | `0047…sql:174` (`coalesce(qty,0)`) | Validate `qty > 0` for annual lines, else raise. | RP-10, AS-03 |
| 29 | Pay (monthly) | **Monthly/flex sale creates a customer but NO subscription record** → invisible to MRR, renewal, churn, AR. | **P1** | `0047…sql:175` (`v_is_annual` false → 8a skipped, no monthly branch) | Confirm intent; if a sub is wanted, add an `else` branch creating a monthly sub (`renewal_date = current_date + 1 month`). | RP-07 |
| 30 | Quote pricing | **Monthly-flex commitment stored as annual×12 in quote builder.** Selecting "Monthly flex" sets `rate = tier.msrp*12` (e.g. ₹920×12 = ₹11,040/yr) for a no-commitment monthly plan → over-states contract value and tax. | **P1** | `quote-builder.tsx:379-404` (`updateCommitment` always ×12) | For `commitment==='monthly'`, don't ×12; define storage unit and divide for display only. | PR-15 |
| 31 | Coupons | **Coupon `discount_value` unit (rupees vs paise) is unguarded and contradicts the paise convention.** First flat coupon entered in paise (or a percent as 1800 meaning 18%) silently mis-discounts 100×. | **P1** | `redeem_coupon` RPC + `coupons/validate/route.ts:95-98` treat value as rupees; CLAUDE.md §13 says paise | Add a CHECK/units comment, clamp `percent` to 0-100, assert rupee scale; add a test coupon to CI. | PR-08 |
| 32 | Extend | **EXTEND clobbers an existing `renewal_quote_id` under race.** The `already_open` guard reads then writes the link unconditionally; a cron renewal that sets it between read and write is silently overwritten → cron's renewal quote orphaned. | **P1** | `lib/renewals/create-extension-quote.ts:73-85` (read) vs `:143-147` (unconditional write) | Conditional write `… where id=$1 and renewal_quote_id is null`; treat 0 rows as `already_open`. | EX-06 |
| 33 | Add-seats | **Non-atomic seat increment (lost update).** Concurrent add-seats calls compute `newSeats` from the same stale read → last write wins, seats undercounted. | **P1** | `lib/subscriptions/add-seats.ts:151-157` (plain `update({seats:newSeats})`, no lock); violates CLAUDE.md §17b | Atomic RPC doing `seats = seats + p_add` under a row lock. | AS-06 |
| 34 | Process / schema | **`redeem_coupon`, `coupons`, `site_promos` exist in prod with NO migration file.** Violates CLAUDE.md §17; next environment rebuild silently loses coupon/promo functionality. | **P1** | live DB only; no file in `supabase/migrations/` | Capture current definitions into versioned migrations. | (CI/schema-drift check) |
| 35 | Renewal | **Hard suspend with grace=0 cuts service with only the T-0 warning** (no grace email on hard suspend). | **P1** | `cron/renewals/route.ts:101` (no email on hard suspend) | Decide policy; send a final/suspension notice or enforce a minimum grace. | RN-10 |
| 36 | Money units | **Rupee vs paise ambiguity across `amount`/`net_payable`/`payments.amount`.** Schema comments say "₹", CLAUDE.md §13 says paise. Self-consistent within each flow today, but any path assuming paise is off 100×. | **P1** (verify) | `invoices.ts` + schema comments vs CLAUDE.md §13 | Pick one unit, document it, add a typed money helper, audit all `amount` writes. | INV-15 |

> P2 items (number gaps, over-payment with no refund path, `expired` status never written, monthly-flex visibility, asymmetric CGST/SGST ₹1 split, auto_renew=false subs never expiring, repeat-buy dedupe, etc.) are tracked in the Section 4 matrix with status 🔴/❓ but are intentionally **not** launch blockers.

---

## 4. Full SCENARIO / TEST MATRIX

> ⚠️ **Statuses below are the original 2026-05-29 snapshot.** Scenarios tied to bugs fixed in §2.1 are now green — notably the `record_payment` idempotency suite (RP-03/04/05/06), the no-duplicate-subscription suite (RP-01, AS-01/02/08, EX-05), the invoice-atomicity suite (INV-02/03/08/09), price-parity (PR-01/02/03/04), GST-head on PDFs (LQ-Q5/RN-18), IST expiry (LQ-A5), and customer-accept conversion (LQ-A2/A6/A7). The SQL regression tests backing these live in `production/supabase/tests/`.

Status legend: ✅ likely ok · 🔴 buggy (confirmed) · ❓ needs run. Test type: **Vitest** (unit/logic), **Playwright** (E2E browser), **SQL** (assertion against a test DB after calling the RPC/flow).

### Segment 1 — Lead → Quote (capture, send, accept)

| ID | Setup | Action | Expected | Status | Test type |
|----|-------|--------|----------|--------|-----------|
| LQ-01 | Authed reseller | Create manual lead | Lead `stage='new'` (table default) | ✅ | Playwright / SQL |
| LQ-02 | Public buy page, Standard, 10 seats | Submit enquiry | Draft quote total == buy-page total | 🔴 (bug #10) | Vitest + SQL |
| LQ-03 | Enquiry, Standard 50 seats | Submit | Single price model; matches page | 🔴 (bugs #10,#11) | Vitest + SQL |
| LQ-04 | Enquiry, Starter / Plus / Enterprise | Submit | Consistent price; Plus/Ent → lead only, no quote | 🔴 Starter (bug #10/#12); ✅ Plus/Ent no-quote by design | Vitest |
| LQ-05 | Enquiry, `next_document_number` collides 3× | Submit | After 3 retries, lead still saved | ✅ (quote silently absent — P2) | Vitest (mock) |
| LQ-06 | Public trial | Submit | Lead `trial`, value 0, no quote | ✅ | SQL |
| LQ-07 | Phone trial (start-trial) | Submit | Lead `trial` via admin client | ✅ (RLS-bypass inconsistency — P2) | Playwright / SQL |
| LQ-Q1 | Builder lead-mode, catalog prefill | Save & send | Quote `sent`, lead→`quote`, plan/seats/value synced | ✅ | Playwright |
| LQ-Q2 | Builder, save draft then Save & send (same session) | Two saves | Same quote ID reused, no wasted number | ✅ | Playwright + SQL |
| LQ-Q5 | Builder, inter-state customer | Build → send | Emailed PDF shows IGST | 🔴 (bug #19) | Vitest (PDF input) |
| LQ-Q7 | Per-line discount + quote-level discount | Compute total | Stored `amount` == recomputed total on accept/send | ❓ | Vitest |
| LQ-Q8 | Quote already `sent` | Re-send | Allowed, status stays sent | ✅ | SQL |
| LQ-Q9 | Quote `accepted`/`rejected` | Send | Blocked 400 | ✅ | Playwright |
| LQ-A1 | Customer opens accept link, quote `sent` | GET page | `sent→viewed` | ✅ (fire-and-forget race — P2) | Playwright |
| LQ-A2 | Customer clicks Accept, `sent`/`viewed`, not expired | POST accept | `accepted` + `awaiting` **and** lead converted/advanced | 🔴 (bug #17) | Playwright + SQL |
| LQ-A3 | Customer accepts already-`accepted` quote | POST | Idempotent (`already:true`) | ✅ | SQL |
| LQ-A5 | Quote `expires_date` = today (IST) | POST accept | Acceptable on the last valid day | 🔴 (bug #18) | Vitest (TZ) |
| LQ-A6 | Operator clicks "Mark accepted" | POST | `accept_quote` RPC converts lead→customer→won | 🔴 (bug #14, RPC missing) | Playwright + SQL |
| LQ-A7 | Customer accepts (LQ-A2) then operator records payment | record_payment | Conversion recovered at payment | ⚠️ partial — works only if payment recorded (bug #17) | SQL |
| LQ-A12 | Builder send, `updateLead` fails | Save & send | Quote saved; lead update best-effort | ✅ (silent — P2) | Vitest |

### Segment 2 — Pricing / GST correctness

| ID | Setup | Action | Expected | Status | Test type |
|----|-------|--------|----------|--------|-----------|
| PR-01 | Standard, 10 seats, catalog live | Buy-now (sim/live) | Charge == displayed card | ✅ today (matches only because catalog has no promo) — but see PR-04 | Vitest + Playwright |
| PR-02 | Standard, 10 seats | Submit enquiry | Quote == buy-page total | 🔴 (bug #10) | Vitest |
| PR-03 | Standard, 50 seats | Submit enquiry | Match page | 🔴 (bugs #10,#11) | Vitest |
| PR-04 | Starter, 10 seats | Card vs enquiry | Consistent; intended retail | 🔴 (bugs #10,#12) | Vitest |
| PR-06 | Enterprise, any | Buy-now | Blocked (custom) | ✅ | Playwright |
| PR-07 | Standard, 10, coupon 10% | Apply then pay | Validate discount == redeemed discount | ✅ (only because display base == checkout base) | Vitest + SQL |
| PR-08 | Flat coupon `discount_value` in paise | Apply | Correct flat ₹ off | 🔴 (bug #31) | Vitest + SQL |
| PR-09 | Coupon at `max_redemptions-1`, two concurrent buyers | Both apply+pay | One succeeds, one refused | ✅ RPC serializes (dry-run can show valid to both — P2) | SQL |
| PR-10 | Coupon discount > subtotal (100% off) | Apply | Usable / clamps | ✅ clamps but buy-now then 400s (P2) | SQL |
| PR-11 | Site promo + coupon both active | Buy-now | Stack promo→coupon, GST once; orders match | ❓ (verify rounding parity) | Vitest + SQL |
| PR-12 | Customer intra (27) vs inter-state | Build quote | Correct head, same grand total | 🔴 server paths store only `tax_rate:18`, no state (bug #23) | SQL |
| PR-13 | Buy-now, GSTIN entered, same-state buyer | Pay | Tax type correct on invoice | 🔴 (bug #23, no place-of-supply) | SQL |
| PR-15 | Quote builder, monthly-flex commitment | Store rate | Storage matches monthly semantics | 🔴 (bug #30, stored ×12) | Vitest |
| PR-18 | SKU disabled mid-session | Buy-now | Sane fallback / refuse | 🔴 (bug #13, silent overcharge) | Vitest + Playwright |
| PR-19 | Seats = 0 | — | Rejected (Zod min 1) | ✅ | Vitest |

### Segment 3 — record_payment core (new-sale + idempotency)

| ID | Setup | Action | Expected | Status | Test type |
|----|-------|--------|----------|--------|-----------|
| RP-01 | Prospect quote, lead, annual line, amount X, no invoice | Pay full X | customer+sub+PO+RV, quote received+accepted, outstanding 0 | ✅ | SQL |
| RP-02 | Same | Pay X/2 (partial) | customer+sub (outstanding X/2), quote `partial`, not accepted | ✅ | SQL |
| RP-03 | Customer has 2 subs; pay balance on one | record_payment | Only that sub's outstanding changes | 🔴 (bug #5) | SQL |
| RP-04 | Prospect, annual | Call twice, same `p_reference` | 2nd is no-op/idempotent | 🔴 (bug #1) | SQL |
| RP-05 | Razorpay `payment.captured` delivered twice (first was partial) | Webhook ×2 | 2nd ignored | 🔴 (bugs #1,#2) | Vitest (webhook) + SQL |
| RP-06 | Webhook retry where 1st RPC succeeded but response failed | Re-deliver | Idempotent | 🔴 if partial (bug #2) | Vitest + SQL |
| RP-07 | Prospect, monthly (flex) line | Pay full | customer + (a sub?) | 🔴/❓ no sub created (bug #29) | SQL |
| RP-08 | Quote `amount` NULL | Pay any | Refuse / not fully-paid | 🔴 (bug #27) | SQL |
| RP-09 | Over-payment, pay > amount | Pay 2× | outstanding 0, excess flagged | 🔴 no refund/credit path (P2) | SQL |
| RP-10 | Annual line, `qty` missing/0 | Pay full | sub with real seats | 🔴 (bug #28, seats=0) | SQL |
| RP-11 | Annual, no customer & lead_id null & customer_id null | Pay full | Refuse, or create sub | 🔴 (bug #6, silent no-sub) | SQL |
| RP-12 | `line_items` empty/not array | Pay full | Graceful / refuse | 🔴 (bug #6 variant) | SQL |
| RP-13 | Existing invoice, partial post-invoice payment | Pay part of net_due | Recorded, invoice pending, status `invoiced`, no RV | ✅ | SQL |
| RP-15 | Intra/inter GST with TDS | record_payment with TDS | TDS receivable committed atomically | 🔴 (bug #22, non-atomic) | Vitest + SQL |
| RP-16 | Two authed users record payment, different references | Both submit | FOR UPDATE serializes; both rows for installments | ✅ (same intent same ref → see RP-04) | SQL |
| RP-18 | Service-role webhook, quote of tenant A | Pay | Tenant derived from quote | ✅ | SQL |
| RP-20 | Health on partial first payment | Pay partial | health 75 | ✅ | SQL |

### Segment 4 — Add-seats & Extend

| ID | Setup | Action | Expected | Status | Test type |
|----|-------|--------|----------|--------|-----------|
| AS-01 | Active annual sub, 5 seats, renewal 200d out, customer present | Add 3 seats, pay pro-rata in full | seats 5→8, mrr bumped, ONE quote accepted, NO new sub | 🔴 (bug #3, dup sub) | SQL |
| AS-02 | Same | Pay in 2 partial installments | Sub updated once, no dup | 🔴 (bugs #3,#4, dup on first partial) | SQL |
| AS-03 | `currentSeats=0` (bad data) | Add seats | Reject or sane pro-rata | 🔴 (bug #28/#6, ₹0 dup sub) | Vitest + SQL |
| AS-04 | `renewal_date` in the past | Add seats | `term_ended` 409 | ✅ | Playwright |
| AS-05 | `renewal_date` today | Add seats | days=0 → `term_ended` | ✅ | Vitest |
| AS-06 | Two operators add seats concurrently | Both | Atomic / one wins, no lost update | 🔴 (bug #33, lost update) | SQL (concurrent) |
| AS-07 | Add-seats quote, customer never pays | — | Seats granted only after payment (policy) | 🔴/policy — seats bumped immediately (P2) | SQL |
| AS-08 | Plan name lacks vendor keyword ("Custom Mail") | Pay add-seats quote | No dup | 🔴 (bug #3 persists, vendor→'other') | SQL |
| AS-09 | Intra vs inter-state GST | Pay | Correct split | ⚠️ flat 18%, no IGST flag (P2) | SQL |
| EX-01 | Active sub, no open renewal_quote_id, pay 2-yr extension full | record_payment | renewal_date +24mo, no new sub | ✅ | SQL |
| EX-02 | Sub already has renewal_quote_id (cron open) | Operator extends | `already_open` 409 | ✅ | Playwright |
| EX-03 | Extension quote paid partially | record_payment | No roll-forward until full, no dup | ✅ | SQL |
| EX-04 | Extension, sub mrr=0 | Pay | ₹0 extension handled | ⚠️ ₹0 accepted (P2) | SQL |
| EX-05 | Pay extension on an already-`renewed` sub | record_payment | Roll forward, no dup | 🔴 (bug #16) | SQL |
| EX-06 | Cron sets renewal_quote_id between extend's read and write | Extend | Cron link preserved | 🔴 (bug #32, clobber) | SQL (concurrent) |
| EX-07 | extension_months < 12 | Pay | Date advances; state handled | ⚠️ stale state (bug #15/RN-08) | SQL |

### Segment 5 — Invoice generation + advance adjustment

| ID | Setup | Action | Expected | Status | Test type |
|----|-------|--------|----------|--------|-----------|
| INV-01 | amount 118000, one payment 118000 | Generate | net 0, paid, paid_date today, 1 voucher frozen, quote→invoiced | ✅ | SQL |
| INV-02 | Quote already invoiced (`invoice_id` set), two concurrent clicks | Generate ×2 | Exactly one invoice | 🔴 (bug #7, dup invoices) | SQL (concurrent) |
| INV-03 | Partial advance; a `record_payment` lands between RPC snapshot and INSERT | Generate | Net consistent with reality | 🔴 (bug #8, snapshot race) | SQL (concurrent) |
| INV-04 | Inter-state customer, advance adjusted | Generate then view | Frozen IGST split | 🔴 (bug #24, not frozen) | Vitest + SQL |
| INV-05 | taxable 99999 @18% → tax 17999 (odd) | View intra | CGST+SGST sum == tax (asymmetric ₹1) | ✅ (lock the total) | Vitest |
| INV-06 | Quote `amount` NULL | Generate | Refuse or treat as 0 | 🔴 (bug #26, ₹0 paid invoice) | SQL |
| INV-07 | Advances total > amount (over-payment) | Generate | net floored 0; excess surfaced | 🔴 excess silently swallowed (bug #7 family — P1) | SQL |
| INV-08 | `next_document_number` succeeds, INSERT fails | Generate | No sequence gap | 🔴 (bug #25) | SQL |
| INV-09 | Invoice INSERT succeeds, quote UPDATE fails | Generate | Atomic — both or neither | 🔴 (bug #9, orphan invoice) | SQL |
| INV-11 | First advance 2026-04-15, generate 2026-05-30 | Generate | `first_advance_at` frozen; aging 45d | ✅ | SQL |
| INV-12 | `payment_received_at` set but no `received` payment row (all refunded) | Generate | Net based on actual ledger | ⚠️ edge inconsistency (P2) | SQL |
| INV-15 | Units: amount/net_payable/payments.amount | Generate | Consistent ₹ vs paise | ❓ verify (bug #36) | Vitest + SQL |

### Segment 6 — Renewal cadence + roll-forward

| ID | Setup | Action | Expected | Status | Test type |
|----|-------|--------|----------|--------|-----------|
| RN-01 | Active sub, renewal in 15d, state pending | Cron runs | notice_sent email + quote + PDF; state→notice_sent | ✅ | SQL + Vitest |
| RN-02 | Same day, cron re-run | 2nd run | No 2nd email; state stays | ✅ (dedup) | SQL |
| RN-03 | Renewal in 14d/13d, state notice_sent | Cron | No email (between triggers) | ✅ | Vitest |
| RN-04 | T-15 cron missed (outage), cron runs at T-12 | Cron | Catch up / still notify | 🔴 (bug #21, no catch-up) | Vitest |
| RN-05 | Renewal date edited to T-2 | Cron | Some reminder fires | 🔴 (bug #21, silent until T-0) | Vitest |
| RN-06 | First renewal payment full, extension_months 12 | record_payment | Roll forward, NOT new sub, state=renewed | ✅ | SQL |
| RN-07 | Renewal quote, partial payment | record_payment | Outstanding tracked on sub | 🔴 sub outstanding never updated (P2) | SQL |
| RN-08 | Renewal paid, quote edited to extension_months=6 | record_payment full | Clean terminal state, no spurious re-quote | 🔴 stale state, re-quoted (bug #15 family — P2) | SQL |
| RN-10 | grace=0, renewal_date yesterday | Cron | Suspend with adequate warning | 🔴 hard cut, only T-0 warning (bug #35) | SQL |
| RN-15 | Customer has no contact_email at T-15 | Cron | Skip + log; state eventually syncs | ⚠️ (P2) | SQL |
| RN-16 | Resend send fails (status='failed') | Cron | Retry next run; same-day manual retry works | 🔴 same-day retry blocked (P2) | SQL |
| RN-17 | Two concurrent renewal payments (double-submit) | record_payment ×2 | One rolls forward, other no-op | ⚠️ safe for ext≥12; 🔴 double-roll if ext<12 (bug #15) | SQL (concurrent) |
| RN-18 | Inter-state customer renewal PDF | Cron renders PDF | IGST shown | 🔴 (bug #20, hardcoded intra) | Vitest (PDF input) |
| RN-19 | Trial lead, expires yesterday, not converted | trial-expiry cron | Stamp expired + 2 emails | ✅ | SQL |
| RN-20 | trial-expiry cron re-run | Re-run | No double-stamp | ✅ | SQL |
| RN-22 | Renewal quote amount=0 (mrr=0 sub) | Cron / payment | Sensible | ⚠️ unrenewable (P2) | SQL |
| RN-23 | Over-payment on renewal | record_payment | Roll forward, outstanding 0, mrr from expected | ✅ | SQL |
| RN-24 | `auto_renew=false` sub past renewal_date | Cron | Lapse / status change | 🔴 stays `active` forever (P2) | SQL |

---

## 5. LAUNCH LINE

The single question this section answers: **which scenarios must be green before you charge a real customer's card?** These are the critical money paths only. If any one is red, do not take live money.

### MUST be green before charging real money (hard blockers) — **all now ✅ (2026-06-01)**

| Scenario | Status | Why it's a hard blocker |
|----------|--------|-------------------------|
| **PR-01, PR-02, PR-03, PR-04** | ✅ | The price you charge must equal the price you showed. Enquiry + checkout now price from one catalog source (bugs #10–#12 fixed). |
| **PR-12 / PR-13** | ✅ | GST split must be determinable at payment — place-of-supply now captured (bug #23 fixed). |
| **RP-01, RP-04, RP-05, RP-06** | ✅ | Core payment works AND a retried/duplicated payment can't double-record — idempotency index live (bugs #1, #2 fixed). |
| **RP-03** | ✅ | Recording a payment no longer corrupts other deals' balances (bug #5 fixed, sub scoped to its quote). |
| **RP-11 / RP-12** | 🟡 | Fully-paid + no-customer silent no-sub (#6) is a documented rare deferral — quotes carry a lead/customer in the real flow. Add the defensive raise before opening a fully public, lead-less checkout. |
| **AS-01, AS-02, AS-08** | ✅ | Add-seats no longer creates a duplicate subscription (bugs #3, #4 fixed). |
| **INV-02, INV-03, INV-09** | ✅ | One supply = exactly one Tax Invoice, atomically — `generate_invoice` RPC + unique index (bugs #7, #8, #9 fixed). |
| **LQ-A6** | ✅ | "Mark accepted" works (`accept_quote` exists — bug #14 was a false alarm) and now also powers customer self-accept conversion (#17). |

### Now FIXED (were on this list in May)

- **LQ-A5** (IST expiry, #18) ✅ · **LQ-Q5 / RN-18** (GST head on quote/renewal PDFs, #19/#20) ✅ — derived correctly now. Inter-state head split on the **issued invoice record** (#24) is still re-derived at view time, not frozen — see below.

### CAN still ship with a documented known issue (fix fast-follow)

- ~~**INV-04** (#24, invoice GST split not *frozen*)~~ ✅ **done** (2026-07-29) — `generate_invoice` already froze `taxable_value/tax_amount/tax_rate/inter_state` (0116); `tax-invoice-dialog.tsx` now reads those frozen columns instead of re-deriving from current customer state, so a later state edit can't retroactively flip an issued invoice's heads.
- ~~**INV-06 / RP-08** (#26, #27 — ₹0/NULL-amount guards)~~ ✅ **done** (migrations 0060/0061) — `generate_invoice` + `record_payment` now reject zero/NULL-amount quotes.
- ~~**RP-15** (TDS non-atomic, #22)~~ ✅ **done** (2026-07-29, migration 0150) — `record_payment_with_tds` commits the TDS receivable atomically with the payment.
- ~~**RN-04 / RN-05** (cadence catch-up, #21)~~ ✅ **done** (2026-07-29) — `decideCadence` now uses catch-up matching (fires the most-urgent trigger whose day ≥ today's daysOut) instead of exact-day equality, so a missed cron day or a renewal_date on a non-trigger day (T-2/T-1) no longer silently skips the reminder. 11 Vitest cases green (`src/lib/renewals/cadence.test.ts`); cron's `renewal_email_log` gives a second (sub, step) idempotency guard.
- **PR-15, PR-08, PR-18** (monthly-flex ×12, coupon units, catalog-vanish 400) — avoid by not offering monthly-flex, not creating coupons, and not editing the catalog mid-session, until fixed.
- **AS-06 / EX-06** (#33, #32 — concurrency lost-update / clobber) — low traffic today; add row-lock RPCs before multi-operator scale.
- All **P2** rows in Section 4.

---

## 6. Recommended test build order

Ordered for maximum safety bought per hour of test-writing. Earlier items both catch the worst bugs and double as the regression net for the fixes you'll ship.

> **Progress (2026-06-01):** steps 1, 2, 4 are **done and green** as SQL suites in `production/supabase/tests/` (`record_payment_idempotency`, `record_payment_sibling_and_extend`, `add_seats_no_duplicate_subscription`, `invoices_one_per_quote`, `generate_invoice_atomic`, `accept_quote_public_conversion`, `record_payment_mrr_ex_gst`, `lead_state_to_customer`, `tenant_scoped_document_ids`, `renewal_and_subscription_creation`). Step 3 (price-parity) + step 5 (GST/TZ) have Vitest coverage in `src/lib/pricing/` + `src/lib/gst/` + `src/lib/utils.test.ts`. **Step 6 (Playwright happy-path E2E) is partially done** — `e2e/money-spine.spec.ts` exists; its no-auth funnel checks (every spine page renders in the app shell, public buy-page price) pass against prod and run in CI via a non-blocking `e2e-smoke` job. The authed full walk (build→send→accept→pay→invoice) self-skips until `.env.test` + seeded Tenant-A/B fixtures land (TASKS.md #7). Step 7 (cadence catch-up) is pending the #21 fix.

1. **SQL idempotency suite for `record_payment` (RP-04, RP-05, RP-06, RP-03).** One test harness that calls the RPC twice with the same reference and asserts a single `received` row, unchanged totals, and untouched sibling subs. This is the highest-leverage hour: it locks bugs #1, #2, #5 and becomes the proof your fix works. *(SQL-on-test-DB)*

2. **SQL "fully-paid must yield exactly one correct subscription" suite (RP-01, RP-11, RP-12, AS-01, AS-02, AS-08, EX-05).** Asserts sub count after payment for new-sale, add-seats, and extend. Directly nails the duplicate-subscription P0s (bugs #3, #4, #16) and the silent-no-sub P0 (bug #6). *(SQL-on-test-DB)*

3. **Vitest price-parity unit tests (PR-01, PR-02, PR-03, PR-04).** Pure functions: feed the same tier+seats into the display/calculator, checkout, and enquiry engines and assert equal totals. Fast, no DB, and forces the "one price engine" refactor. *(Vitest)*

4. **SQL invoice-atomicity suite (INV-02, INV-03, INV-09, INV-06, INV-08).** Concurrent-generate assertions + unique-constraint check. Validates the single atomic `generate_invoice` RPC you'll build to fix bugs #7–#9, #25, #26. *(SQL-on-test-DB)*

5. **Vitest GST-split + TZ-expiry unit tests (LQ-A5, LQ-Q5, RN-18, INV-04, INV-05).** Pure date/tax math; cheap and they pin the customer-visible correctness bugs (#18, #19, #20, #24). *(Vitest)*

6. **Playwright happy-path E2E (LQ-Q1, LQ-A2, LQ-A6, AS-04, EX-02).** End-to-end smoke of build→send→accept→pay and the operator actions, so a future refactor can't silently break the whole funnel. Slowest to write, so last — but run on every deploy. *(Playwright E2E)*

7. **Vitest cadence-catch-up tests (RN-04, RN-05).** After the catch-up refactor (bug #21), assert that a simulated missed day still fires the right tier. *(Vitest)*

> Principle: write the **SQL assertions on the money RPCs first** (steps 1–2, 4) — they are where the P0s live and where the fixes need a regression net. Save **Playwright** for last because it's the most expensive to author and maintain, even though it gives the broadest coverage.

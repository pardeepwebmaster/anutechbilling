# Manual Test Script — for Pardeep (run in the real app)

> The automated tests cover the money-correctness (database) layer. THIS script covers
> what only a human can check: the actual UI, emails, WhatsApp, PDFs, and the full
> click-through journeys. Run it **after deploying** the latest `v3-dev` build.
>
> **What you need:** the deployed app URL, a test email you control (e.g. your Gmail),
> and Razorpay in **test mode** (or the buy page in simulation mode if live keys aren't set yet).
>
> **How to read:** each step has **Do** (what to click) and **Expect ✓** (what should happen).
> If any **Expect ✓** is wrong, note the step number and tell Claude — don't launch until fixed.

---

## Pre-check — prices (2 min)
1. **Do:** Open `/buy/workspace` on the live site.
   **Expect ✓:** Starter shows **₹270/user/month**, Standard shows **₹864** (with "20% off ₹1,080"). NOT ₹136/₹736.
2. **Do:** Change the seat slider (e.g. 10 → 25 seats).
   **Expect ✓:** Total updates live; Standard 25 seats ≈ ₹864×25×12 = ₹2,59,200 + 18% GST.

---

## Journey 1 — Inbound prospect → paid (the main flow, ~10 min)

**Use an inter-state customer to test IGST. Pretend you're a Maharashtra customer.**

1. **Do:** On `/buy/workspace`, pick **Standard, 10 seats**, click **"Email me a quote"**, fill the form with your test email + a Maharashtra address.
   **Expect ✓:** "Thanks" confirmation. Two emails arrive: one to you (Pardeep) "New lead", one to the test email "quote on the way".
2. **Do:** Open the app → **Leads**.
   **Expect ✓:** New lead "…" at stage **new**, source buy-workspace. A **draft quote already exists** (open the lead — see the auto-quote ID + amount).
3. **Do:** Open the draft quote.
   **Expect ✓:** Line item = Google Workspace Standard ×10 at **₹864/mo (₹10,368/yr)**. Total = ₹1,03,680 **+ IGST 18%** (because Maharashtra ≠ your Delhi) = **₹1,22,342**. NOT CGST+SGST.
4. **Do:** Click **Send**.
   **Expect ✓:** Status → **sent**. A quote email + PDF goes to the test email. **Open the PDF — GST line says IGST** (not CGST/SGST). *(If it shows CGST/SGST, that's known bug #19 — note it.)*
5. **Do:** From the test email, open the quote link → **Accept**.
   **Expect ✓:** Quote → **accepted**.
6. **Do:** Pay via Razorpay test card (or simulation).
   **Expect ✓:** After payment:
   - Lead → **won**
   - A **Customer** record is created (the company)
   - **One** Subscription appears: active, 10 seats, renewal date = +1 year
   - A **Receipt Voucher** (RV-2026-27-…) exists
   - Quote → **accepted / received**
7. **Do:** Refresh / re-open (simulate a webhook retry if you can).
   **Expect ✓:** Still **one** payment, **one** subscription — no duplicates.
8. **Do:** On the quote, click **Generate GST Invoice**.
   **Expect ✓:** One invoice (INV-2026-27-…), marked **paid**, IGST split, advance adjusted. Click Generate again → it should NOT create a second invoice.

> **Red flags:** two subscriptions, two invoices, two payments, wrong GST head (CGST/SGST for a Maharashtra customer), or total ≠ ₹1,22,342.

---

## Journey 2 — Add seats (no duplicate, ~5 min)

1. **Do:** Open the customer from Journey 1 (10-seat sub). Use **Add seats → +5**.
   **Expect ✓:** A pro-rata quote is created (5 seats × remaining days). Subscription seats show **15**.
2. **Do:** Pay that add-seats quote.
   **Expect ✓:** **Still ONE subscription** (now 15 seats) — NOT a second subscription. MRR updated. *(This was the bug you found — now fixed.)*

> **Red flag:** a second/duplicate subscription appears for the same customer.

---

## Journey 3 — Intra-state customer (GST check, ~5 min)

1. **Do:** Create a quote for a **Delhi** customer (same state as you), Standard ×10.
   **Expect ✓:** GST = **CGST 9% + SGST 9%** (NOT IGST), total same ₹1,22,342.
2. **Do:** Record a **partial** payment (half), then the **balance** (use two different reference numbers).
   **Expect ✓:** Two payments recorded; status partial → received; correct outstanding in between; one subscription.

> **Red flag:** IGST shown for a Delhi customer, or the second payment blocked/duplicated.

---

## Journey 4 — Renewal (optional, needs a near-due sub)

1. **Do:** Find/seed a subscription with renewal date ~15 days out (or use **"Send now"** on Renewals to force a reminder).
   **Expect ✓:** A renewal quote is generated + reminder email sent.
2. **Do:** Pay the renewal quote.
   **Expect ✓:** Same subscription's renewal date moves **+1 year**, status active — **no new subscription**, no duplicate.

---

## Quick spot-checks (anytime)
- [ ] WhatsApp send works (if configured) and doesn't block anything if it fails.
- [ ] Customer portal: a customer can log in (magic link) and see their invoices/orders.
- [ ] Dashboard KPIs (MRR, Accepted MTD) move after a paid quote.
- [ ] On mobile: buy page + quote page look right (responsive).

---

## What "complete tested" looks like
- ✅ Journeys 1–3 pass with **no duplicates** and **correct GST** → the money spine is launch-safe for a soft launch.
- Automated tests (in `production/supabase/tests/`) keep these correct on every change.
- Remaining known bugs are tracked in `docs/MONEY-FLOW-TEST-MATRIX.md` (fix before wider launch, but not all are soft-launch blockers).

> Report any failed **Expect ✓** by step number — Claude will reproduce, fix, and add a regression test so it can't break again.

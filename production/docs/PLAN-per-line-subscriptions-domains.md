# Plan — Per-line subscriptions, each with its own domain (money-spine)

**Status:** approved by Pardeep (2026-08-07) — do in a dedicated, test-backed session.
**Why:** A quote can have multiple products (Google Workspace for domain A + M365 for
domain B). Domain is a property of each **subscription line**, not the whole quote.

## Current reality (code-verified in `record_payment`)
- `record_payment` builds the subscription **only from `line_items[0]`** (`v_first_line`).
  - Non-bulk first line → **one** subscription (plan = line[0].name, seats = line[0].qty,
    domain = quote.domain → lead.domain → customer.domain).
  - Bulk first line (`line.bulk` + `line.domains[]`) → **one subscription per domain**
    (fan-out loop over `v_first_line->'domains'`).
- So **multiple distinct product lines are NOT modelled** — only line[0] becomes a
  subscription. Quote totals sum all lines, but the money-spine collapses to one sub.
- Interim quote-level `domain` field (commits payment-domain / quote-domain /
  domain-relocation, Aug 2026) works for the single-product case; the full fix supersedes it.

## Target model
- Each **subscription** line item (not one-off/direct-invoice) → its **own** subscription
  row, with its **own optional domain** (stored per line in `line_items[i].domain`, plus
  the existing per-line `domains[]` bulk fan-out).
- Payment is **allocated across the lines** (proportional to each line's annual amount, or
  fill-order — decide + document); each subscription's `mrr`, `seats`, `outstanding_amount`
  reflect ITS line only. Sum of per-line outstanding == quote outstanding (invariant).
- Purchase-order lines, `customer_domains`, MRR/ARR rollups all derive per subscription.

## Work items
1. **UI (quote-builder):** move domain to **per line** — an optional `domain` on each
   subscription line row (remove the quote-level field). Persist in `line_items[i].domain`.
2. **RPC (`record_payment`) migration:** loop over ALL subscription lines; create a
   subscription per line with its line's domain (keep the bulk `domains[]` fan-out inside
   a line). Split the settled amount across lines; set per-line outstanding/mrr/seats.
   Keep single-line behaviour byte-identical (regression guard).
3. **Downstream:** purchase-order creation per sub; renewals roll-forward per sub; invoice
   generation still keyed to the quote (unchanged); outstanding-receivables view per sub.
4. **types + query hooks** for any shape changes.

## Test matrix (rolled-back RPC tests — service_role DO block + RAISE to roll back)
- Single non-bulk line → 1 sub, correct domain (regression: identical to today).
- Two distinct product lines, each with a domain → 2 subs, each with ITS domain;
  Σ outstanding == quote outstanding; Σ mrr == expected.
- Bulk line (domains[]) still fans out per domain (regression).
- Partial payment across multi-line → allocation invariant holds; no double-count.
- Renewal quote (line[0] change) → rolls forward the right sub(s).
- TDS path (`record_payment_with_tds`) unaffected / mirrored.

## Guardrails
- Money-correctness > speed. Ship behind rolled-back tests; `npm run typecheck` clean;
  verify on localhost before deploy. Versioned migration file in `supabase/migrations/`.
- Do NOT change the RPC signature ambiguously (avoid overload ambiguity — CREATE OR
  REPLACE with same arg list, or DROP+CREATE deliberately).

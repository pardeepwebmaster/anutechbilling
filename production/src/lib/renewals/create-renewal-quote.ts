/**
 * createRenewalQuote — shared helper to issue a renewal quote for a subscription.
 *
 * Idempotent: if the subscription already has a `renewal_quote_id`, returns
 * that existing quote unchanged. Both the daily cron and the on-demand
 * "Generate renewal quote" API call this so behaviour stays identical
 * whether the system or the operator triggers it.
 *
 * Behaviour:
 *   1. If subscription.renewal_quote_id is set → load that quote, return it.
 *   2. Otherwise:
 *        - Issue a fresh quote number via the next_document_number RPC.
 *        - Build a single-line annual quote from the subscription's plan/seats/MRR.
 *        - Validity = renewal_date + tenant.grace_period_days.
 *        - Insert the quote.
 *        - Link it back to subscription.renewal_quote_id.
 *        - Return the new quote.
 *
 * Server-only — needs a service-role Supabase client because it writes
 * across customers/quotes/subscriptions inside one tenant's data.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, QuoteLineItem } from "@/lib/supabase/database.types";

// The actual typed Supabase client. createAdminClient() returns this shape,
// so the strict rpc/from overloads stay intact when callers pass it in.
type SupabaseAdmin = SupabaseClient<Database>;

export interface CreateRenewalQuoteInput {
  supabase:        SupabaseAdmin;
  subscriptionId:  string;
  tenantId:        string;
  customerId:      string | null;
  customerName:    string;
  plan:            string;
  seats:           number;
  mrr:             number;          // monthly run rate (₹)
  renewalDate:     string;          // ISO date or YYYY-MM-DD
  graceDays:       number;          // tenant.grace_period_days
  /** Existing renewal_quote_id, if any. When present, we just load and return it. */
  existingQuoteId?: string | null;
  /** Optional override — defaults to false (auto-created note). */
  notes?:          string;
}

export interface RenewalQuoteResult {
  quoteId:    string;
  amount:     number;
  subtotal:   number;
  discountPct: number;
  taxRate:    number;
  lineItems:  QuoteLineItem[];
  /** True if a brand-new quote was created in this call. */
  created:    boolean;
}

export async function createOrGetRenewalQuote(
  input: CreateRenewalQuoteInput,
): Promise<RenewalQuoteResult | null> {
  const { supabase, existingQuoteId } = input;

  // ── Path 1: subscription already has a renewal quote — load + return ──
  if (existingQuoteId) {
    const { data: q } = await supabase
      .from("quotes")
      .select("id, amount, line_items, subtotal, discount_pct, tax_rate")
      .eq("id", existingQuoteId)
      .single();
    if (q) {
      return {
        quoteId:     q.id as string,
        amount:      (q.amount as number) ?? 0,
        subtotal:    (q.subtotal as number) ?? 0,
        discountPct: (q.discount_pct as number) ?? 0,
        taxRate:     (q.tax_rate as number) ?? 18,
        lineItems:   ((q.line_items ?? []) as QuoteLineItem[]),
        created:     false,
      };
    }
    // If the linked quote was deleted somehow, fall through and create fresh
  }

  // ── Path 2: create a new quote ────────────────────────────────────
  const { data: nextNumber } = await supabase.rpc("next_document_number", {
    p_doc_type:  "quote",
    p_tenant_id: input.tenantId,
  });
  const newQuoteId = nextNumber as unknown as string;
  if (!newQuoteId) return null;

  const annualAmount = Math.max(0, Math.round((input.mrr ?? 0) * 12));
  const perSeatRate  = Math.round(annualAmount / Math.max(1, input.seats));
  const perSeatCost  = Math.round((annualAmount * 0.83) / Math.max(1, input.seats));

  const lineItems: QuoteLineItem[] = [{
    id:         "renewal-1",
    name:       input.plan,
    qty:        input.seats,
    rate:       perSeatRate,
    cost:       perSeatCost,
    commitment: "annual_yearly",
  }];

  const renewalAt   = new Date(input.renewalDate);
  const validUntil  = new Date(renewalAt.getTime() + (input.graceDays ?? 0) * 86400000);

  const { error: insertErr } = await supabase.from("quotes").insert({
    id:             newQuoteId,
    tenant_id:      input.tenantId,
    customer_id:    input.customerId,
    customer_name:  input.customerName,
    plan:           input.plan,
    seats:          input.seats,
    amount:         annualAmount,
    status:         "sent",
    payment_status: "awaiting",
    owner_id:       null,
    created_date:   new Date().toISOString().slice(0, 10),
    expires_date:   validUntil.toISOString().slice(0, 10),
    line_items:     lineItems,
    subtotal:       annualAmount,
    total_cost:     Math.round(annualAmount * 0.83),
    discount_pct:   0,
    tax_rate:       18,
    is_renewal:     true,  // ← Drives the "Renewal" badge in /quotes list + detail + PDF
    notes:          input.notes
      ?? `Renewal quote for subscription ${input.subscriptionId}`,
  });
  if (insertErr) return null;

  // Link back to subscription
  await supabase
    .from("subscriptions")
    .update({ renewal_quote_id: newQuoteId })
    .eq("id", input.subscriptionId);

  return {
    quoteId:     newQuoteId,
    amount:      annualAmount,
    subtotal:    annualAmount,
    discountPct: 0,
    taxRate:     18,
    lineItems,
    created:     true,
  };
}

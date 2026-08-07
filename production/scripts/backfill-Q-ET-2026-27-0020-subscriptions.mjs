#!/usr/bin/env node
/**
 * One-off backfill for quote Q-ET-2026-27-0020 (customer remote.anutech.in),
 * the real invoice that surfaced the record_payment single-line bug fixed
 * in migration 0172. This quote had 3 line items (Google Workspace, Starter
 * hosting, Premium support) but the old function only created a
 * subscription for line 0 (Workspace) — and inflated ITS mrr to the whole
 * quote's value (4417) instead of just its own share (2700), since the old
 * code divided the WHOLE subtotal by 12 for the single subscription it made.
 *
 * This script:
 *   1. Corrects the existing Workspace subscription's mrr: 4417 -> 2700
 *      (its own qty*rate/12, matching what 0172 would compute per-line).
 *   2. Creates the two missing subscriptions (Starter hosting, Premium
 *      support) with mrr split the same way 0172 does going forward.
 *   3. Creates a draft purchase_order for each new subscription, matching
 *      record_payment's own wholesale-cost fallback formula.
 *
 * Sum check: 2700 + 50 + 1667 = 4417 — exactly the old single mrr value,
 * confirming this is a pure redistribution, not new or lost revenue.
 *
 * Run once. Not idempotent by design (no re-run guard) — hence the
 * hardcoded quote id instead of a generic tool.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const QUOTE_ID = "Q-ET-2026-27-0020";
const TENANT_ID = "fbb976f1-9090-4f10-9726-0901bd144e42";
const CUSTOMER_ID = "69d987c8-e8dc-4f43-84c8-5eb1d7ac029a";
const CUSTOMER_NAME = "remote.anutech.in";
const START_DATE = "2026-08-06";
const RENEWAL_DATE = "2027-08-06";
const EXISTING_WORKSPACE_SUB_ID = "7c3221b2-254b-4cf1-aedf-6000ad3269bb";

const MISSING_LINES = [
  { name: "Starter", vendor: "hosting", seats: 1, rate: 600, itemId: "ad943e44-53b4-471e-b1f1-72e0f3394f78" },
  { name: "Premium", vendor: "support", seats: 1, rate: 20000, itemId: "1b8e4a98-0bc6-448f-850b-f8f421306f4a" },
];

async function main() {
  // 1. Fix the existing Workspace subscription's mrr.
  const { error: fixErr } = await supabase
    .from("subscriptions")
    .update({ mrr: 2700 })
    .eq("id", EXISTING_WORKSPACE_SUB_ID);
  if (fixErr) throw fixErr;
  console.log(`Corrected Workspace subscription ${EXISTING_WORKSPACE_SUB_ID} mrr: 4417 -> 2700`);

  for (const line of MISSING_LINES) {
    const lineAmount = line.seats * line.rate;
    const mrr = Math.round(lineAmount / 12);

    const { data: sub, error: subErr } = await supabase
      .from("subscriptions")
      .insert({
        tenant_id: TENANT_ID,
        customer_id: CUSTOMER_ID,
        customer_name: CUSTOMER_NAME,
        plan: line.name,
        vendor: line.vendor,
        seats: line.seats,
        mrr,
        start_date: START_DATE,
        renewal_date: RENEWAL_DATE,
        status: "active",
        outstanding_amount: 0,
        domain: null,
        quote_id: QUOTE_ID,
      })
      .select("id")
      .single();
    if (subErr) throw subErr;
    console.log(`Created subscription for "${line.name}" (${line.vendor}): id=${sub.id}, mrr=${mrr}`);

    const unitWholesalePm = Math.max(0, Math.round((lineAmount * 0.83) / (line.seats * 12)));
    const totalCost = unitWholesalePm * line.seats * 12;

    const { data: poId, error: poIdErr } = await supabase.rpc("next_document_number", {
      p_doc_type: "purchase_order",
      p_tenant_id: TENANT_ID,
    });
    if (poIdErr) throw poIdErr;

    const { error: poErr } = await supabase.from("purchase_orders").insert({
      id: poId,
      tenant_id: TENANT_ID,
      subscription_id: sub.id,
      customer_id: CUSTOMER_ID,
      customer_name: CUSTOMER_NAME,
      domain: null,
      vendor: line.vendor,
      plan: line.name,
      seats: line.seats,
      term_months: 12,
      unit_cost_pm: unitWholesalePm,
      total_cost: totalCost,
      status: "draft",
      notes: `Backfilled for quote ${QUOTE_ID} — missing subscription recovered after fixing record_payment's single-line-item bug (migration 0172)`,
    });
    if (poErr) throw poErr;
    console.log(`Created PO ${poId} for "${line.name}": unit_cost_pm=${unitWholesalePm}, total_cost=${totalCost}`);
  }

  console.log("\nBackfill complete. Final state:");
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("plan, vendor, mrr, seats")
    .eq("quote_id", QUOTE_ID);
  console.table(subs);
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exitCode = 1;
});

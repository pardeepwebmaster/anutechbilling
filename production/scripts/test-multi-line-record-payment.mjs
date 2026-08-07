#!/usr/bin/env node
/**
 * One-off verification for migration 0172 (record_payment multi-line
 * subscriptions). Creates a throwaway customer + a quote with 3
 * subscription-worthy line items (support, hosting, and a hand-typed
 * Workspace line with no item_id to exercise the name-guess fallback),
 * calls record_payment for the full amount, asserts 3 subscriptions + 3
 * purchase_orders got created with the correct vendors, then deletes
 * everything it created. Never run in CI — this is a manual, throwaway check.
 *
 * Usage: node scripts/test-multi-line-record-payment.mjs <tenantId>
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { config } from "dotenv";
config({ path: ".env.local" });

const tenantId = process.argv[2];
if (!tenantId) {
  console.error("Usage: node scripts/test-multi-line-record-payment.mjs <tenantId>");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let customerId, quoteId;

async function main() {
  // Pick one real catalog item each for support + hosting (whatever's
  // active for this tenant) so the item_id → items.vendor lookup path is
  // exercised for real, not guessed.
  const { data: items, error: itemsErr } = await supabase
    .from("items")
    .select("id, name, vendor, msrp")
    .eq("tenant_id", tenantId)
    .in("vendor", ["support", "hosting"])
    .eq("is_active", true)
    .limit(10);
  if (itemsErr) throw itemsErr;
  const supportItem = items.find((i) => i.vendor === "support");
  const hostingItem = items.find((i) => i.vendor === "hosting");
  if (!supportItem || !hostingItem) {
    throw new Error(
      `Need at least one active 'support' and one 'hosting' catalog item for tenant ${tenantId}. Found: ${JSON.stringify(items)}`
    );
  }
  console.log(`Using catalog items: support="${supportItem.name}" (₹${supportItem.msrp}/mo), hosting="${hostingItem.name}" (₹${hostingItem.msrp}/mo)`);

  // 1. Throwaway customer
  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .insert({
      tenant_id: tenantId,
      name: "TEST-0172-multi-line (delete me)",
      domain: "test-0172.example.com",
      since: new Date().toISOString().slice(0, 10),
      health: 80,
    })
    .select("id")
    .single();
  if (custErr) throw custErr;
  customerId = customer.id;
  console.log(`Created test customer ${customerId}`);

  // 2. Quote with 3 subscription-worthy lines:
  //    - support item (item_id set → exact vendor lookup)
  //    - hosting item (item_id set → exact vendor lookup)
  //    - hand-typed "Google Workspace" line, NO item_id → exercises the
  //      name-guess fallback, should still resolve to vendor='google'
  const supportRate = supportItem.msrp * 12; // rate = ₹/seat/year
  const hostingRate = hostingItem.msrp * 12;
  const workspaceRate = 1600 * 12; // arbitrary, matches nothing real — fine, it's a fallback-path check
  const lineItems = [
    {
      item_id: supportItem.id,
      name: supportItem.name,
      qty: 1,
      rate: supportRate,
      list_rate: supportRate,
      commitment: "annual_yearly",
      discount_pct: 0,
    },
    {
      item_id: hostingItem.id,
      name: hostingItem.name,
      qty: 1,
      rate: hostingRate,
      list_rate: hostingRate,
      commitment: "annual_yearly",
      discount_pct: 0,
    },
    {
      name: "Google Workspace Business Starter",
      qty: 2,
      rate: workspaceRate,
      list_rate: workspaceRate,
      commitment: "annual_yearly",
      discount_pct: 0,
      domain: "acme-workspace-test.example.com", // per-line domain (0172 addendum) — should land on THIS subscription only
    },
  ];
  const subtotal = lineItems.reduce((s, l) => s + l.qty * l.rate, 0);
  const amount = Math.round(subtotal * 1.18); // rough GST-inclusive total, doesn't need to be exact for this check

  const { data: quote, error: quoteErr } = await supabase
    .from("quotes")
    .insert({
      id: `TEST-0172-${randomUUID().slice(0, 8)}`,
      tenant_id: tenantId,
      customer_id: customerId,
      customer_name: "TEST-0172-multi-line (delete me)",
      line_items: lineItems,
      subtotal,
      amount,
      status: "draft",
      payment_status: "awaiting",
    })
    .select("id")
    .single();
  if (quoteErr) throw quoteErr;
  quoteId = quote.id;
  console.log(`Created test quote ${quoteId} (amount ₹${amount})`);

  // 3. Pay it in full via record_payment — the function under test.
  const { data: result, error: payErr } = await supabase.rpc("record_payment", {
    p_quote_id: quoteId,
    p_amount: amount,
    p_method: "bank_transfer",
    p_reference: `TEST-0172-${Date.now()}`,
    p_notes: "automated verification for migration 0172 — safe to ignore/delete",
  });
  if (payErr) throw payErr;
  console.log("record_payment result:", JSON.stringify(result, null, 2));

  // 4. Assert: 3 subscriptions, correct vendors, 3 purchase_orders.
  const { data: subs, error: subsErr } = await supabase
    .from("subscriptions")
    .select("id, plan, vendor, mrr, seats, outstanding_amount, domain")
    .eq("quote_id", quoteId);
  if (subsErr) throw subsErr;
  console.log(`\nSubscriptions created: ${subs.length}`);
  subs.forEach((s) => console.log(`  - ${s.plan} | vendor=${s.vendor} | mrr=${s.mrr} | seats=${s.seats} | outstanding=${s.outstanding_amount} | domain=${s.domain}`));

  const { data: pos, error: posErr } = await supabase
    .from("purchase_orders")
    .select("id, plan, vendor, subscription_id")
    .eq("customer_id", customerId);
  if (posErr) throw posErr;
  console.log(`\nPurchase orders created: ${pos.length}`);
  pos.forEach((p) => console.log(`  - ${p.plan} | vendor=${p.vendor} | subscription_id=${p.subscription_id}`));

  const expectedVendors = new Set([supportItem.vendor, hostingItem.vendor, "google"]);
  const gotVendors = new Set(subs.map((s) => s.vendor));
  const pass =
    subs.length === 3 &&
    pos.length === 3 &&
    [...expectedVendors].every((v) => gotVendors.has(v));

  console.log(`\n${pass ? "PASS" : "FAIL"}: expected 3 subs + 3 POs with vendors ${[...expectedVendors].join(", ")}; got ${subs.length} subs (vendors: ${[...gotVendors].join(", ")}) + ${pos.length} POs`);
  if (!pass) process.exitCode = 1;
}

async function cleanup() {
  console.log("\nCleaning up test data...");
  if (quoteId) {
    await supabase.from("purchase_orders").delete().eq("customer_id", customerId);
    await supabase.from("subscriptions").delete().eq("quote_id", quoteId);
    await supabase.from("payments").delete().eq("quote_id", quoteId);
    await supabase.from("quotes").delete().eq("id", quoteId);
  }
  if (customerId) {
    await supabase.from("customer_domains").delete().eq("customer_id", customerId);
    await supabase.from("customers").delete().eq("id", customerId);
  }
  console.log("Cleanup done.");
}

main()
  .catch((err) => {
    console.error("ERROR:", err);
    process.exitCode = 1;
  })
  .finally(cleanup);

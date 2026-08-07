#!/usr/bin/env node
/**
 * Stage 5 foundation — one-off, manually-run sync. NOT wired into any cron
 * or live path. Reads Customer Panel's active HostingPlan records and
 * upserts matching rows into this tenant's `items` catalog (vendor='hosting'),
 * so GET /api/v1/hosting-plans has something real to return.
 *
 * Requires migration 0169 (vendor enum 'hosting' value) to have been run
 * first — inserts will fail with an invalid-enum-value error otherwise.
 *
 * Usage: node scripts/sync-hosting-plans-from-customer-panel.mjs <tenantId>
 *   MONGODB_URI          — Customer Panel's Mongo connection string
 *   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — from .env.local
 *
 * Upserts by name (case-insensitive) within the tenant — imprecise but
 * fine for a one-time seed you can eyeball afterward; re-running is safe
 * (updates msrp in place rather than duplicating).
 */
import { MongoClient } from "mongodb";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import "dotenv/config";

const tenantId = process.argv[2];
if (!tenantId) {
  console.error("Usage: node scripts/sync-hosting-plans-from-customer-panel.mjs <tenantId>");
  process.exit(1);
}

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error("Set MONGODB_URI (Customer Panel's connection string) in the environment for this run.");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const mongo = new MongoClient(mongoUri);
await mongo.connect();
const plans = await mongo
  .db()
  .collection("hostingplans")
  .find({ isActive: true })
  .toArray();
await mongo.close();

console.log(`Found ${plans.length} active hosting plans in Customer Panel.`);

for (const plan of plans) {
  const { data: existing } = await supabase
    .from("items")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("vendor", "hosting")
    .ilike("name", plan.name)
    .maybeSingle();

  if (existing) {
    await supabase.from("items").update({ msrp: plan.price ?? 0 }).eq("id", existing.id);
    console.log(`Updated: ${plan.name} -> ₹${plan.price}`);
  } else {
    await supabase.from("items").insert({
      id: randomUUID(),
      tenant_id: tenantId,
      name: plan.name,
      vendor: "hosting",
      item_type: "subscription",
      msrp: plan.price ?? 0,
      wholesale: 0,
      is_active: true,
    });
    console.log(`Created: ${plan.name} -> ₹${plan.price}`);
  }
}

console.log("Done.");

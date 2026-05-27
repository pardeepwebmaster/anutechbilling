/**
 * POST /api/subscriptions/[id]/add-seats
 *
 * Mid-term seat expansion. Operator-triggered when customer requests
 * additional seats while the current subscription term is active.
 *
 * Behaviour:
 *   1. Pro-rata calculation: annual_rate × additional_seats × (days_remaining / 365)
 *   2. subscription.seats incremented immediately + mrr recomputed
 *   3. Quote created for the pro-rata billing (sent, awaiting payment)
 *
 * Body: { additional_seats: 1..5000 }
 * Returns: { quoteId, amount, proRataDays, newSeats, newMrr }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { addSeats } from "@/lib/subscriptions/add-seats";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  additional_seats: z.coerce.number().int().min(1).max(5000),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userClient = createClient();
  const { data: authData } = await userClient.auth.getUser();
  if (!authData?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: me } = await userClient
    .from("users")
    .select("tenant_id")
    .eq("id", authData.user.id)
    .single();
  if (!me?.tenant_id) {
    return NextResponse.json({ error: "user not linked to a tenant" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body: " + parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: sub, error: subErr } = await supabase
    .from("subscriptions")
    .select(
      `id, tenant_id, customer_id, customer_name, plan, vendor, domain, seats, mrr, renewal_date, status`
    )
    .eq("id", params.id)
    .single();
  if (subErr || !sub) {
    return NextResponse.json({ error: "subscription not found" }, { status: 404 });
  }
  if (sub.tenant_id !== me.tenant_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (sub.status !== "active") {
    return NextResponse.json(
      { error: `cannot add seats — subscription is ${sub.status}` },
      { status: 400 }
    );
  }
  if (!sub.renewal_date) {
    return NextResponse.json({ error: "subscription has no renewal_date" }, { status: 400 });
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("grace_period_days")
    .eq("id", sub.tenant_id)
    .single();

  const result = await addSeats({
    supabase,
    subscriptionId:  sub.id,
    tenantId:        sub.tenant_id,
    customerId:      sub.customer_id,
    customerName:    sub.customer_name,
    plan:            sub.plan,
    vendor:          sub.vendor,
    domain:          sub.domain,
    currentSeats:    sub.seats,
    currentMrr:      sub.mrr,
    additionalSeats: parsed.data.additional_seats,
    renewalDate:     sub.renewal_date,
    graceDays:       tenant?.grace_period_days ?? 7,
  });

  if (!result.ok) {
    const status = result.code === "term_ended" ? 409 : 400;
    return NextResponse.json({ error: result.message, code: result.code }, { status });
  }

  return NextResponse.json({
    quoteId:        result.quoteId,
    amount:         result.amount,
    proRataDays:    result.proRataDays,
    newSeats:       result.newSeats,
    newMrr:         result.newMrr,
    poId:           result.poId,
    subscriptionId: sub.id,
  });
}

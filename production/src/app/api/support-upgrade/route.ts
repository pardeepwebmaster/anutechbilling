/**
 * POST /api/support-upgrade
 *
 * The Support Panel (DSP) already runs its own complete upgrade flow —
 * its own Razorpay checkout, its own plan/expiry tracking, its own retry
 * queue (pending_billing_syncs) if this call fails. This endpoint is
 * DSP's one-way notification after a payment has ALREADY been collected
 * on its side — it does not collect payment or create a quote (unlike
 * the domain/hosting or manual-upgrade-quote paths elsewhere in this
 * API). It just needs to: (1) generate a compliant invoice for the money
 * that changed hands, and (2) track the plan as a subscription so
 * Billing's renewal cron can see it. Idempotent by payment_ref — DSP's
 * retry worker may call this more than once for the same payment.
 *
 * Body: { billing_customer_id?, email, plan, plan_expiry, payment_ref,
 *         payment_mode?, amount }
 * Auth: same Authorization: Bearer <key> as the rest of /api/v1/* —
 * DSP already uses this exact header style (see its postJson helper).
 *
 * plan='free' is a separate, no-payment case — DSP's daily expiry worker
 * calls this (or should) when a paid plan lapses and the customer reverts
 * to Free automatically, with no Razorpay payment involved. No invoice is
 * created; the subscription is just set to Free with no renewal_date, so
 * Billing's cron ignores it (nothing to remind about on a ₹0 plan).
 */
import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveCustomer } from "@/lib/api/v1-customer";
import { billingCustomerId } from "@/lib/api/v1-mappers";
import { unauthorized, badRequest } from "@/lib/api/v1-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth) return unauthorized();

  const body = await req.json().catch(() => null) as {
    billing_customer_id?: string | null;
    email?: string;
    plan?: string;
    plan_expiry?: string;
    payment_ref?: string;
    payment_mode?: string;
    amount?: number;
  } | null;

  const email = body?.email?.trim();
  const plan = body?.plan?.trim();
  const planExpiry = body?.plan_expiry?.trim();
  const paymentRef = body?.payment_ref?.trim();
  const amount = body?.amount ?? 0;
  const isFree = plan?.toLowerCase() === "free";
  if (!email || !plan || (!isFree && (!planExpiry || !paymentRef))) {
    return badRequest("email and plan are required (plan_expiry and payment_ref required unless plan=free)");
  }

  const admin = createAdminClient();

  // ── Resolve the customer: by billing_customer_id if DSP already has one,
  // else by email (creating if genuinely new) ──
  let customer = body?.billing_customer_id
    ? await resolveCustomer(admin, auth.tenantId, body.billing_customer_id)
    : null;

  if (!customer) {
    const { data: byEmail } = await admin
      .from("customers").select("*")
      .eq("tenant_id", auth.tenantId)
      .ilike("contact_email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    customer = byEmail ?? null;
  }
  if (!customer) {
    const { data: created, error: createErr } = await admin
      .from("customers")
      .insert({ tenant_id: auth.tenantId, name: email, contact_email: email })
      .select("*")
      .single();
    if (createErr || !created) return badRequest("Could not resolve customer");
    customer = created;
  }
  const customerId = customer.id;
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1); // 'basic' -> 'Basic'

  // ── Free: no payment, no invoice — just set/update the subscription and
  // clear its renewal_date so the cron has nothing to remind about ──
  if (isFree) {
    const { data: existingSub } = await admin
      .from("subscriptions")
      .select("id")
      .eq("tenant_id", auth.tenantId)
      .eq("customer_id", customerId)
      .eq("vendor", "support" as "google" | "microsoft" | "zoho" | "other")
      .maybeSingle();

    if (existingSub) {
      await admin.from("subscriptions").update({
        plan: "Free", mrr: 0, status: "active", auto_renew: false, renewal_date: null,
      }).eq("id", existingSub.id);
    } else {
      await admin.from("subscriptions").insert({
        tenant_id: auth.tenantId, customer_id: customerId, customer_name: customer.name,
        plan: "Free", vendor: "support" as "google" | "microsoft" | "zoho" | "other",
        seats: 1, mrr: 0, status: "active", auto_renew: false,
        start_date: new Date().toISOString().slice(0, 10),
      });
    }
    return NextResponse.json({ ok: true, plan: "Free", billing_customer_id: billingCustomerId(customer) });
  }

  // Guaranteed non-null past this point — the isFree branch above returned
  // already, and the initial validation required both unless isFree.
  if (!planExpiry || !paymentRef) return badRequest("plan_expiry and payment_ref are required");

  // ── Idempotency: DSP's retry worker may call this again for the same
  // payment — a payment row with this reference already existing means
  // we've already processed it. ──
  const { data: existingPayment } = await admin
    .from("payments").select("id")
    .eq("tenant_id", auth.tenantId)
    .eq("reference", paymentRef)
    .maybeSingle();
  if (existingPayment) {
    return NextResponse.json({
      alreadyProcessed: true,
      billing_customer_id: billingCustomerId(customer),
    });
  }

  // ── Invoice (skip record_payment — see docs/…; direct mark-paid instead,
  // same pattern as the Customer Panel checkout invoicing path) ──
  const { data: invoiceResult, error: rpcError } = await admin.rpc("create_direct_invoice", {
    p_customer_id: customerId,
    p_line_items: [{
      id: crypto.randomUUID(),
      name: `${planLabel} Support Plan`,
      qty: 1,
      rate: Math.round(amount / 1.18),
      cost: 0,
    }],
    p_notes: `Support Panel upgrade — payment ${paymentRef}`,
    p_recurring: false,
  });
  if (rpcError || !invoiceResult || invoiceResult.length === 0) {
    return badRequest(rpcError?.message || "Could not create invoice");
  }
  const { invoice_id: invoiceId, quote_id: quoteId, net_payable: netPayable } = invoiceResult[0];

  await admin.from("invoices")
    .update({ status: "paid", paid_date: new Date().toISOString().slice(0, 10) })
    .eq("id", invoiceId);

  await admin.from("payments").insert({
    tenant_id: auth.tenantId,
    quote_id: quoteId,
    customer_id: customerId,
    amount: netPayable,
    method: "razorpay",
    reference: paymentRef,
  });

  // ── Subscription tracking, keyed to DSP's own plan_expiry (not our own
  // +1yr guess) — vendor='support', same generic pattern as domain/hosting ──
  const { data: existingSub } = await admin
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", auth.tenantId)
    .eq("customer_id", customerId)
    // Cast: vendor='support' added by migration 0170, generated types stale.
    .eq("vendor", "support" as "google" | "microsoft" | "zoho" | "other")
    .maybeSingle();

  const mrr = Math.round(amount / 12);
  if (existingSub) {
    await admin.from("subscriptions").update({
      plan: planLabel, mrr, status: "active", auto_renew: true, renewal_date: planExpiry,
    }).eq("id", existingSub.id);
  } else {
    await admin.from("subscriptions").insert({
      tenant_id: auth.tenantId, customer_id: customerId, customer_name: customer.name,
      plan: planLabel, vendor: "support" as "google" | "microsoft" | "zoho" | "other",
      seats: 1, mrr, status: "active", auto_renew: true,
      start_date: new Date().toISOString().slice(0, 10),
      renewal_date: planExpiry,
    });
  }

  return NextResponse.json({
    ok: true,
    billing_customer_id: billingCustomerId(customer),
    invoiceId,
  });
}

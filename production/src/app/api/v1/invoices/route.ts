/**
 * POST /api/v1/invoices
 *
 * Used by Customer Panel to create a real, GST-compliant invoice for an
 * already-paid order (Razorpay payment confirmed on their side before this
 * call) — the Zoho-replacement path. Resolves/creates the customer by email
 * (same idempotent pattern as POST /customers), then reuses the app's own
 * battle-tested `create_direct_invoice` RPC for numbering + GST math.
 *
 * Deliberately does NOT call `record_payment` — that RPC's subscription-
 * creation branch triggers on ANY non-'monthly' commitment (including
 * 'one_time'), which would silently create a bogus annual subscription for
 * a plain domain/hosting sale. Instead this marks the invoice paid and
 * records the payment directly, with no subscription side effect.
 *
 * Body: { email, name, lineItems: [{ description, qty, rate }], amount,
 *         razorpayPaymentId }
 */
import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { mapInvoice, billingCustomerId } from "@/lib/api/v1-mappers";
import { pdfDownloadUrl } from "@/lib/pdf/pdf-token";
import { unauthorized, badRequest, requestBaseUrl } from "@/lib/api/v1-response";
import type { Invoice as InvoiceRow } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LineItemInput {
  description?: string;
  qty?: number;
  rate?: number;
}

interface RenewalItemInput {
  itemType: "domain" | "hosting";
  domainName: string;
  renewalDate: string; // YYYY-MM-DD
  amount: number; // annualised, integer INR
  /** DirectAdmin username for hosting items — see upsertRenewalSubscription. */
  externalRef?: string;
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth) return unauthorized();

  const body = await req.json().catch(() => null) as {
    email?: string;
    name?: string;
    lineItems?: LineItemInput[];
    amount?: number;
    razorpayPaymentId?: string;
    // Stage 1: when present, one subscription-tracking row per item is
    // created/updated so Billing's renewal cron can pick these up later —
    // see createOrUpdateRenewalTracking below. Optional and additive; an
    // invoice with no renewalItems behaves exactly as before.
    renewalItems?: RenewalItemInput[];
  } | null;

  const email = body?.email?.trim();
  const name = body?.name?.trim();
  const lineItems = body?.lineItems;
  const razorpayPaymentId = body?.razorpayPaymentId?.trim();
  if (!email || !name || !Array.isArray(lineItems) || lineItems.length === 0 || !razorpayPaymentId) {
    return badRequest("email, name, lineItems (non-empty), and razorpayPaymentId are required");
  }

  const admin = createAdminClient();

  // ── Resolve or create the customer (same idempotent pattern as POST /customers) ──
  const { data: existingCustomer } = await admin
    .from("customers").select("id, customer_number")
    .eq("tenant_id", auth.tenantId)
    .ilike("contact_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let customerId = existingCustomer?.id as string | undefined;
  let customerNumber = existingCustomer?.customer_number as string | null | undefined;
  if (!customerId) {
    const { data: created, error: createErr } = await admin
      .from("customers")
      .insert({ tenant_id: auth.tenantId, name, contact_email: email })
      .select("id, customer_number")
      .single();
    if (createErr || !created) return badRequest("Could not resolve customer");
    customerId = created.id;
    customerNumber = created.customer_number;
  }

  // ── Create the invoice via the app's own numbering + GST RPC ──
  // id/cost aren't read by create_direct_invoice's SQL (it only reads
  // qty/rate/name off the jsonb) — filled in only to satisfy the RPC's
  // generated QuoteLineItem[] param type, which is shaped for the
  // quote-builder UI's fuller line-item model.
  const lineItemsJsonb = lineItems.map((li) => ({
    id: crypto.randomUUID(),
    name: li.description ?? "Item",
    qty: li.qty ?? 1,
    rate: li.rate ?? 0,
    cost: 0,
  }));

  const { data: invoiceResult, error: rpcError } = await admin.rpc("create_direct_invoice", {
    p_customer_id: customerId,
    p_line_items: lineItemsJsonb,
    p_notes: `Customer Panel order — Razorpay payment ${razorpayPaymentId}`,
    p_recurring: false,
  });
  if (rpcError || !invoiceResult || invoiceResult.length === 0) {
    return badRequest(rpcError?.message || "Could not create invoice");
  }
  const { invoice_id: invoiceId, quote_id: quoteId, net_payable: netPayable } = invoiceResult[0];

  // ── Mark paid + record the payment directly (no record_payment RPC — see
  // module docstring for why) ──
  await admin
    .from("invoices")
    .update({ status: "paid", paid_date: new Date().toISOString().slice(0, 10) })
    .eq("id", invoiceId);

  await admin.from("payments").insert({
    tenant_id: auth.tenantId,
    quote_id: quoteId,
    customer_id: customerId,
    amount: netPayable,
    method: "razorpay",
    reference: razorpayPaymentId,
  });

  // ── Stage 1: renewal-tracking rows (best-effort — never fails the invoice) ──
  const renewalItems = body?.renewalItems;
  if (Array.isArray(renewalItems) && renewalItems.length > 0) {
    for (const item of renewalItems) {
      try {
        await upsertRenewalSubscription(admin, {
          tenantId: auth.tenantId,
          customerId,
          customerName: name,
          item,
        });
      } catch {
        // Renewal tracking is additive/nice-to-have at this stage — a
        // failure here must never block the invoice the customer is
        // waiting on.
      }
    }
  }

  const { data: invoiceRow, error: fetchErr } = await admin
    .from("invoices").select("*").eq("id", invoiceId).single();
  if (fetchErr || !invoiceRow) return badRequest("Invoice created but could not be re-fetched");

  const base = requestBaseUrl(req);
  return NextResponse.json({
    created: true,
    billing_customer_id: billingCustomerId({ id: customerId, customer_number: customerNumber ?? null }),
    ...mapInvoice(invoiceRow as InvoiceRow, pdfDownloadUrl(base, "invoice", invoiceId, auth.tenantId)),
  });
}

/**
 * Create or update a `subscriptions` row so Billing's existing renewal cron
 * (app/api/cron/renewals/route.ts) — which already tracks ANY vendor
 * uniformly off status/auto_renew/renewal_date, no vendor branching — picks
 * this domain/hosting item up for future renewal reminders, exactly like a
 * Workspace subscription. Requires the 'domain'/'hosting' vendor enum
 * values (migration 0169) to exist; until that migration runs, this insert
 * will fail — caught by the best-effort wrapper at the call site.
 *
 * Idempotent by (tenant_id, customer_id, vendor, domain) — vendor is part
 * of the match key because a domain and its hosting commonly share the
 * same domain name but are two distinct trackable items; matching on
 * domain alone collapsed them into one row (caught via testing — see git
 * history). A later renewal for the same item updates its renewal_date
 * instead of creating a duplicate subscription every time this endpoint
 * is called.
 */
async function upsertRenewalSubscription(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    tenantId: string;
    customerId: string;
    customerName: string;
    item: RenewalItemInput;
  }
): Promise<void> {
  const { tenantId, customerId, customerName, item } = input;
  const domainKey = item.domainName.toLowerCase().trim();
  const mrr = Math.round(item.amount / 12);

  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("customer_id", customerId)
    .eq("vendor", item.itemType as "google" | "microsoft" | "zoho" | "other")
    .ilike("domain", domainKey)
    .maybeSingle();

  if (existing) {
    await admin
      .from("subscriptions")
      .update({
        renewal_date: item.renewalDate,
        mrr,
        status: "active",
        auto_renew: true,
        // Cast: external_ref added by migration 0171, generated types stale.
        ...(item.externalRef ? ({ external_ref: item.externalRef } as never) : {}),
      })
      .eq("id", existing.id);
    return;
  }

  await admin.from("subscriptions").insert({
    tenant_id: tenantId,
    customer_id: customerId,
    customer_name: customerName,
    plan: item.itemType === "domain" ? `Domain — ${item.domainName}` : `Hosting — ${item.domainName}`,
    ...(item.externalRef ? ({ external_ref: item.externalRef } as never) : {}),
    // Cast: database.types.ts is generated from the live schema and hasn't
    // been regenerated since migration 0169 added these enum values (needs
    // to be run against the real DB first — see route module docstring in
    // the caller). Runtime-correct once that migration has executed.
    vendor: item.itemType as "google" | "microsoft" | "zoho" | "other",
    seats: 1,
    mrr,
    start_date: new Date().toISOString().slice(0, 10),
    renewal_date: item.renewalDate,
    status: "active",
    auto_renew: true,
    domain: domainKey,
  });
}
